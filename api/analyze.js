const axios = require('axios');
const cheerio = require('cheerio');

const userAgents = [
    // Windows Browsers
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',

    // macOS Browsers
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0',

    // Linux Browsers
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',

    // iOS Browsers
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1',

    // Android Browsers
    'Mozilla/5.0 (Linux; Android 11; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36 EdgA/46.3.4.5155',
    'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
];

async function fetchWithRetry(url, config, retries = 3, backoffFactor = 1.5) {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios(url, config);
        } catch (error) {
            if (i === retries - 1) throw error;
            const delay = Math.pow(backoffFactor, i) * 1000 + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function fetchPriruckaData(sourceWord) {
    const word = sourceWord.split(' ')[0]; // in case of particles se/si etc.
    const url = `https://prirucka.ujc.cas.cz/?slovo=${encodeURIComponent(word)}`;

    const config = {
        headers: {
            'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        },
        timeout: 30000, // 30 seconds timeout
    };

    const response = await axios.get(url, config);

    if (response.data.includes("Some other request from your IP address")) {
        console.log("WARNING: Detected 'Some other request from your IP address' in the response.");
        return {error: "WARNING: Detected 'Some other request from your IP address' in the response.",
            table: "WARNING: Detected 'Some other request from your IP address' in the response."
        };
    }

    const $ = cheerio.load(response.data);
    const table = $('#content > div:nth-child(2) > table');
    const nounRodVariant1 = $('#content > div:nth-child(2) > p:nth-child(3)').text().trim();
    const nounRodVariant2 = $('#content > div:nth-child(2) > p:nth-child(4)').text().trim();
    let nounRodFull;
    if (nounRodVariant1.toLowerCase().startsWith('rod:')) {
        nounRodFull = nounRodVariant1;
    } else {
        nounRodFull = nounRodVariant2;
    }

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
    
    try {
        const response = await axios.get(url, {
            validateStatus: function (status) {
                return status >= 200 && status < 500; // Принимаем любой статус, кроме 5xx ошибок
            },
        });

        if (response.status === 404) {
            console.log(`Word "${word}" not found in Slovnik.`);
            return { partOfSpeech: null, error: 'Word not found' };
        }

        if (response.status !== 200) {
            console.log(`Unexpected status code ${response.status} for word "${word}"`);
            return { partOfSpeech: null, error: `Unexpected status: ${response.status}` };
        }

        const $ = cheerio.load(response.data);
        const partOfSpeech = $('.Box--partOfSpeech header h2 span').text().trim();
        
        return { partOfSpeech: partOfSpeech || null };
    } catch (error) {
        console.error(`Error fetching data for word "${word}":`, error.message);
        return { partOfSpeech: null, error: error.message };
    }
}

function determineNounRod(nounRodFull) {
    if (nounRodFull?.includes("m. neživ.")) return "mužský_neživ";
    if (nounRodFull?.includes("m. živ.")) return "mužský_živ";
    if (nounRodFull?.includes("s.")) return "střední";
    if (nounRodFull?.includes("ž.")) return "ženský";
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
            if (genitiv_single.endsWith("a") && akuzativ_plural.endsWith("y")) return "Les";
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
    const infinitiveCore = infinitive.split(' ')[0]; // to exclude particles se and si from the analysis

    if (infinitiveCore.endsWith('ovat') || infinitive.endsWith('nout')) return 3;
    if (infinitiveCore.endsWith('at')) return 1;
    if (infinitiveCore.endsWith('it') || infinitive.endsWith('et') || infinitive.endsWith('ět')) return 2;
    return 'NOT_DEFINED';
}

function determineVerbConjugation(osoba2jednCislo) {
    const osoba2jednCisloCore = osoba2jednCislo.split(' ')[0]; // to exclude particles se and si from the analysis

    if (osoba2jednCisloCore.endsWith('áš')) return { vzor: 'Dělat', group: 1 };
    if (osoba2jednCisloCore.endsWith('íš')) return { vzor: 'Mluvit', group: 2 };
    if (osoba2jednCisloCore.endsWith('ješ')) return { vzor: 'Studovat', group: 3 };
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
            const slovnikData = await fetchSlovnikData(word);
            let partOfSpeechType = determinePartOfSpeechType(slovnikData?.partOfSpeech);
            const priruckaData = await fetchPriruckaData(word, partOfSpeechType);
            if (partOfSpeechType === "NOT_DEFINED" && priruckaData?.table?.['2. osoba']) {
                partOfSpeechType = 'Sloveso';
            }            
            
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

            console.log(`Analysis of word "${word}" is complete. Result is `, czechWordGrammar);
            return res.status(200).json(czechWordGrammar);
        } catch (error) {
            console.error('Error during analysis:', error);
            return res.status(500).json({ error: `Error analyzing word "${word}": ${error.message}` });
        }
    }

    // Если метод запроса не GET или OPTIONS
    return res.status(405).json({ error: 'Method Not Allowed' });
};