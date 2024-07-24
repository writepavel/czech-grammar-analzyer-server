const axios = require('axios');
const cheerio = require('cheerio');

// ... (оставьте остальные функции без изменений)

module.exports = async (req, res) => {
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

    const { word } = req.query;
    if (!word) {
        return res.status(400).json({ error: 'Word parameter is required' });
    }

    try {
        const priruckaData = await fetchPriruckaData(word);
        const slovnikData = await fetchSlovnikData(word);
        
        res.status(200).json({
            word: word,
            priruckaData: priruckaData,
            slovnikData: slovnikData
        });
    } catch (error) {
        console.error('Error during analysis:', error);
        res.status(500).json({ error: `Error analyzing word "${word}": ${error.message}` });
    }
};
