const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/analyze/:word', async (req, res) => {
    const word = req.params.word;
    try {
        const priruckaData = await fetchPriruckaData(word);
        const slovnikData = await fetchSlovnikData(word);
        
        res.json({
            word: word,
            priruckaData: priruckaData,
            slovnikData: slovnikData
        });
    } catch (error) {
        console.error('Error during analysis:', error);
        res.status(500).json({ error: `Error analyzing word "${word}": ${error.message}` });
    }
});

async function fetchPriruckaData(word) {
    const url = `https://prirucka.ujc.cas.cz/?slovo=${encodeURIComponent(word)}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const table = $('#content > div:nth-child(2) > table');
    return table.length ? parseTable($, table) : null;
}

function parseTable($, table) {
    const data = {};
    table.find('tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
            const key = $(cells[0]).text().trim();
            const values = cells.slice(1).map((i, cell) => $(cell).text().trim()).get();
            data[key] = values;
        }
    });
    return data;
}

async function fetchSlovnikData(word) {
    const url = `https://slovnik.seznam.cz/preklad/cesky_anglicky/${encodeURIComponent(word)}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const partOfSpeech = $('.Box--partOfSpeech header h2 span').text().trim();
    return { partOfSpeech };
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
