const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const { addonBuilder } = require("stremio-addon-sdk");

const manifest = {
  id: "org.serialgo.addon",
  version: "1.0.0",
  name: "SerialGo Addon",
  description: "Watch SerialGo shows in Stremio",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  catalogs: [{ type: "series", id: "serialgo", name: "SerialGo Shows" }]
};

const addon = new addonBuilder(manifest);
const baseURL = "https://www.serialgo.to";

// --- Catalog handler ---
addon.defineCatalogHandler(async ({ type, id, extra }) => {
  try {
    const response = await axios.get(`${baseURL}/series`);
    const $ = cheerio.load(response.data);

    const shows = [];
    $("a[href^='/series/']").each((i, elem) => {
      const link = $(elem).attr("href");
      const name = $(elem).text().trim();
      if (link && name) {
        shows.push({
          id: link,
          name,
          type: "series",
          poster: "https://via.placeholder.com/200"
        });
      }
    });

    return { metas: shows.slice(0, 50) }; // Limit to 50 shows
  } catch (err) {
    console.error("Catalog error:", err);
    return { metas: [] };
  }
});

// --- Meta handler ---
addon.defineMetaHandler(async ({ type, id }) => {
  try {
    const response = await axios.get(baseURL + id);
    const $ = cheerio.load(response.data);
    const title = $("h1").first().text().trim();
    const description = $("meta[name='description']").attr("content") || "";
    const poster = $("img").first().attr("src") || "https://via.placeholder.com/200";

    const episodes = [];
    $("a[href^='/episode/']").each((i, elem) => {
      episodes.push({
        id: $(elem).attr("href"),
        name: $(elem).text().trim()
      });
    });

    return {
      meta: {
        id,
        type: "series",
        name: title,
        description,
        poster,
        episodes
      }
    };
  } catch (err) {
    console.error("Meta error:", err);
    return { meta: null };
  }
});

// --- Stream handler ---
addon.defineStreamHandler(async ({ type, id }) => {
  try {
    const response = await axios.get(baseURL + id);
    const $ = cheerio.load(response.data);

    const streams = [];
    $("iframe").each((i, elem) => {
      const src = $(elem).attr("src");
      if (src && src.includes("mp4")) {
        streams.push({
          title: `Episode ${i + 1}`,
          url: src,
          infoHash: null
        });
      }
    });

    if (streams.length === 0) {
      streams.push({
        title: "Episode",
        url: baseURL + id,
        infoHash: null
      });
    }

    return { streams };
  } catch (err) {
    console.error("Stream error:", err);
    return { streams: [] };
  }
});

// --- Express setup ---
const app = express();
app.use(cors());
app.use("/", addon.getInterface());

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SerialGo Addon running at http://localhost:${port}`));
