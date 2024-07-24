const axios = require('axios');
const cheerio = require('cheerio');

async function fetchPriruckaData(word) {
    const url = `https://prirucka.ujc.cas.cz/?slovo=${encodeURIComponent(word)}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const table = $('#content > div:nth-child(2) > table');
    const nounRodFull = $('#content > div:nth-child(2) > p:nth-child(3)').text().trim();
    return { 
        table: table.length ? parseTable($, table) : null,
        nounRodFull: nounRodFull
    };
}

function parseTable($, table) {
    const data = {};
    table.find('tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
            const key = $(cells[0]).text().trim();
            const values = cells.slice(1).map((i, cell) => {
                return $(cell).text().trim().replace(/\d+$/, '').trim();
            }).get();
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

function determineNounRod(nounRodFull) {
    if (nounRodFull.includes("m. neživ.")) return "mužský_neživ";
    if (nounRodFull.includes("m. živ.")) return "mužský_živ";
    if (nounRodFull.includes("s.")) return "střední";
    if (nounRodFull.includes("ž.")) return "ženský";
    return "NOT_DEFINED";
}

function getNounForms(priruckaData) {
    const table = priruckaData.table;
    if (!table || !table['1. pád'] || !table['2. pád'] || !table['4. pád']) {
        return {
            nominativ_single: "NO_GRAMMAR_TABLE",
            nominativ_plural: "NO_GRAMMAR_TABLE",
            genitiv_single: "NO_GRAMMAR_TABLE",
            akuzativ_plural: "NO_GRAMMAR_TABLE"
        };
    }

    return {
        nominativ_single: table['1. pád'][0] || "NOT_DEFINED",
        nominativ_plural: table['1. pád'][1] || "NOT_DEFINED",
        genitiv_single: table['2. pád'][0] || "NOT_DEFINED",
        akuzativ_plural: table['4. pád'][1] || "NOT_DEFINED"
    };
}

function determineNounVzor(nounRod, forms) {
    if (nounRod === "NOT_DEFINED" || Object.values(forms).some(v => v === "NOT_DEFINED" || v === "NO_GRAMMAR_TABLE")) {
        return "NOT_DEFINED";
    }

    const { nominativ_single, nominativ_plural, genitiv_single, akuzativ_plural } = forms;

    switch (nounRod) {
        case "mužský_živ":
            if (nominativ_single.endsWith("a")) return "Předseda";
            if (nominativ_single.endsWith("e")) return "Soudce";
            if (genitiv_single.endsWith("a")) return "Pán";
            if (genitiv_single.endsWith("e")) return "Muž";
            return "NOT_DEFINED";
        case "mužský_neživ":
            if (genitiv_single.endsWith("u") && akuzativ_plural.endsWith("y")) return "Hrad";
            if (genitiv_single.endsWith("e") && akuzativ_plural.endsWith("e")) return "Stroj";
            if (genitiv_single.endsWith("e") && akuzativ_plural.endsWith("y")) return "Kamen";
            return "NOT_DEFINED";
        case "ženský":
            if (nominativ_single.endsWith("a")) return "Žena";
            if (nominativ_single.endsWith("e")) return "Růže";
            if (nominativ_plural.endsWith("i")) return "Kost";
            return "Píseň";
        case "střední":
            if (nominativ_single.endsWith("o")) return "Město";
            if (nominativ_single.endsWith("e")) return "Moře";
            if (nominativ_single.endsWith("í")) return "Stavení";
            return "Kuře";
        default:
            return "NOT_DEFINED";
    }
}

function determinePartOfSpeechType(partOfSpeechFull) {
    if (!partOfSpeechFull) return 'NOT_DEFINED';
    const types = [
        'Sloveso', 'Podstatné jméno', 'Přídavné jméno', 'Příslovce', 'Číslovka',
        'Předložka', 'Zájmeno', 'Spojka', 'Částice', 'Citoslovce'
    ];
    const lowercaseFullType = partOfSpeechFull.toLowerCase();
    for (const type of types) {
        if (lowercaseFullType.includes(type.toLowerCase())) {
            return type;
        }
    }
    return 'NOT_DEFINED';
}

function determineVerbSuffixGroup(infinitive) {
    if (infinitive.endsWith('ovat') || infinitive.endsWith('nout')) return 3;
    if (infinitive.endsWith('at')) return 1;
    if (infinitive.endsWith('it') || infinitive.endsWith('et') || infinitive.endsWith('ět')) return 2;
    return 'NOT_DEFINED';
}

function determineVerbConjugation(osoba2jednCislo) {
    if (osoba2jednCislo.endsWith('áš')) return { vzor: 'Dělat', group: 1 };
    if (osoba2jednCislo.endsWith('íš')) return { vzor: 'Mluvit', group: 2 };
    if (osoba2jednCislo.endsWith('ješ')) return { vzor: 'Studovat', group: 3 };
    return { vzor: 'NOT_DEFINED', group: 'NOT_DEFINED' };
}

function determineIfIrregular(suffixGroup, conjugationGroup) {
    if (suffixGroup === 'NO_GRAMMAR_TABLE' || conjugationGroup === 'NOT_DEFINED') return 'NOT_DEFINED';
    if (suffixGroup === conjugationGroup) return false;
    return true;
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
            
            let czechWordGrammar = {
                word: word,
                priruckaData: priruckaData.table,
                slovnikData: slovnikData,
                partOfSpeechFull: slovnikData.partOfSpeech,
                partOfSpeechType: determinePartOfSpeechType(slovnikData.partOfSpeech)
            };

            if (czechWordGrammar.partOfSpeechType === 'Podstatné jméno') {
                czechWordGrammar.nounRodFull = priruckaData.nounRodFull;
                czechWordGrammar.nounRod = determineNounRod(priruckaData.nounRodFull);
                const nounForms = getNounForms(priruckaData);
                czechWordGrammar = { ...czechWordGrammar, ...nounForms };
                czechWordGrammar.nounVzor = determineNounVzor(czechWordGrammar.nounRod, nounForms);
            } else if (czechWordGrammar.partOfSpeechType === 'Sloveso') {
                czechWordGrammar.verbSuffixGroup = determineVerbSuffixGroup(word);
                
                if (czechWordGrammar.priruckaData) {
                    czechWordGrammar.osoba2jednCislo = czechWordGrammar.priruckaData['2. osoba']?.[0] || 'NOT_DEFINED';
                    const conjugationInfo = determineVerbConjugation(czechWordGrammar.osoba2jednCislo);
                    czechWordGrammar.verbVzor = conjugationInfo.vzor;
                    czechWordGrammar.verbConjugationGroup = conjugationInfo.group;
                } else {
                    czechWordGrammar.verbVzor = 'NO_GRAMMAR_TABLE';
                    czechWordGrammar.verbConjugationGroup = 'NO_GRAMMAR_TABLE';
                }

                czechWordGrammar.isIrregularVerb = determineIfIrregular(czechWordGrammar.verbSuffixGroup, czechWordGrammar.verbConjugationGroup);
            }

            console.log('Analysis complete');
            return res.status(200).json(czechWordGrammar);
        } catch (error) {
            console.error('Error during analysis:', error);
            return res.status(500).json({ error: `Error analyzing word "${word}": ${error.message}` });
        }
    }

    // Если метод запроса не GET или OPTIONS
    return res.status(405).json({ error: 'Method Not Allowed' });
};