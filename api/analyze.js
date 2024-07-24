const axios = require('axios');
const cheerio = require('cheerio');

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

module.exports = async (req, res) => {
    console.log('Received request:', req.method, req.url);

    // Настройка CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Обработка предварительных запросов OPTIONS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Обработка GET запросов
    if (req.method === 'GET') {
        const { word } = req.query;
        if (!word) {
            console.log('No word provided');
            return res.status(400).json({ error: 'Word parameter is required' });
        }

        console.log('Analyzing word:', word);

        try {
            const priruckaData = await fetchPriruckaData(word);
            const slovnikData = await fetchSlovnikData(word);
            
            console.log('Analysis complete');
            return res.status(200).json({
                word: word,
                priruckaData: priruckaData,
                slovnikData: slovnikData
            });
        } catch (error) {
            console.error('Error during analysis:', error);
            return res.status(500).json({ error: `Error analyzing word "${word}": ${error.message}` });
        }
    }

    // Если метод запроса не GET или OPTIONS
    return res.status(405).json({ error: 'Method Not Allowed' });
};