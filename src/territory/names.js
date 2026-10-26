// Nation names: historical dynasties, empires and peoples, picked from the
// part of the world a nation spawns in, mixed with names invented from
// old-sounding syllables (always, once a region's names are used up).

// [name, test(lon, lat)] in priority order; the first matching region wins.
const REGIONS = [
  ["southAsia", (lon, lat) => lon >= 60 && lon <= 97 && lat >= 5 && lat <= 37],
  ["southeastAsia", (lon, lat) => lon >= 92 && lon <= 155 && lat >= -11 && lat < 22],
  ["eastAsia", (lon, lat) => lon >= 97 && lon <= 150 && lat >= 22 && lat <= 55],
  ["middleEast", (lon, lat) => lon >= 25 && lon <= 63 && lat >= 12 && lat <= 42],
  ["steppe", (lon, lat) => lon >= 40 && lat > 42],
  ["europe", (lon, lat) => lon >= -25 && lon < 45 && lat >= 36],
  ["northAfrica", (lon, lat) => lon >= -20 && lon <= 40 && lat >= 15 && lat < 37],
  ["africa", (lon, lat) => lon >= -20 && lon <= 55 && lat < 15],
  ["mesoamerica", (lon, lat) => lon >= -120 && lon <= -75 && lat >= 7 && lat < 30],
  ["northAmerica", (lon, lat) => lon < -30 && lat >= 30],
  ["southAmerica", (lon, lat) => lon >= -95 && lon <= -30 && lat < 15],
  ["oceania", (lon, lat) => lon >= 110 && lat < -10],
];

const POOLS = {
  southAsia: ["Maurya", "Gupta", "Mughal", "Chola", "Pala", "Maratha", "Kushan", "Chalukya", "Pallava", "Vijayanagara", "Satavahana", "Rashtrakuta", "Pandya", "Kalinga"],
  eastAsia: ["Qin", "Han", "Tang", "Song", "Yuan", "Ming", "Qing", "Zhou", "Shang", "Goryeo", "Joseon", "Silla", "Tokugawa", "Yamato", "Ashikaga", "Liao"],
  southeastAsia: ["Khmer", "Srivijaya", "Majapahit", "Ayutthaya", "Pagan", "Champa", "Mataram", "Dai Viet", "Sukhothai", "Lan Xang", "Malacca", "Funan"],
  steppe: ["Golden Horde", "Muscovy", "Romanov", "Kievan Rus", "Timurid", "Xiongnu", "Göktürk", "Khazar", "Sibir", "Novgorod", "Chagatai", "Kazan", "Uyghur", "Rouran"],
  middleEast: ["Achaemenid", "Sassanid", "Parthia", "Abbasid", "Umayyad", "Seljuk", "Ottoman", "Babylon", "Assyria", "Akkad", "Safavid", "Ayyubid", "Hittite", "Phoenicia", "Sumer"],
  europe: ["Rome", "Byzantium", "Carolingian", "Habsburg", "Bourbon", "Tudor", "Plantagenet", "Merovingian", "Macedon", "Sparta", "Athens", "Venice", "Valois", "Castile", "Aragon", "Wessex", "Jagiellon", "Árpád", "Medici", "Hohenzollern"],
  northAfrica: ["Carthage", "Ptolemaic", "Fatimid", "Almohad", "Almoravid", "Mamluk", "Numidia", "Marinid", "Kush", "Thebes", "Memphis", "Meroë"],
  africa: ["Songhai", "Wagadu", "Aksum", "Kongo", "Mutapa", "Oyo", "Zulu", "Kanem", "Ashanti", "Kilwa", "Buganda", "Solomonid", "Luba", "Sokoto", "Dahomey", "Lunda"],
  mesoamerica: ["Aztec", "Maya", "Toltec", "Olmec", "Zapotec", "Mixtec", "Tarascan", "Teotihuacan", "Tlaxcala"],
  northAmerica: ["Iroquois", "Cahokia", "Pueblo", "Mississippian", "Cherokee", "Lakota", "Comanche", "Shawnee", "Haida", "Hopewell", "Thule", "Cree"],
  southAmerica: ["Inca", "Moche", "Chimú", "Nazca", "Tiwanaku", "Wari", "Muisca", "Chavín", "Mapuche", "Guaraní", "Tupi", "Arawak"],
  oceania: ["Tu'i Tonga", "Lapita", "Hawaiki", "Kamehameha", "Yolngu", "Eora", "Arrernte", "Noongar"],
};

// Invented names: a start, an optional middle and an ending.
const STARTS = [
  "Val", "Kar", "Thar", "Os", "Mer", "Ald", "Ver", "Zan", "Hel", "Dor", "Ish", "Nor", "Bel", "Cor", "Ely", "Tor", "Ul", "Sar", "Rha", "Mon",
  "Ash", "Bran", "Cael", "Drav", "Eld", "Fen", "Gal", "Hal", "Iv", "Jor", "Kel", "Lun", "Mor", "Nyr", "Or", "Pel", "Quel", "Ras", "Syl", "Tal",
  "Vor", "Wyn", "Xan", "Yr", "Zar", "Ar", "Bor", "Cyr", "Dra", "Er", "Gor", "Hyr", "Kor", "Lor", "Myr", "Nar", "Ost", "Pra", "Ser", "Thal",
];
const MIDDLES = ["", "", "", "a", "e", "i", "o", "u", "ae", "ar", "en", "il", "or", "ath", "el", "is", "un", "ov", "an", "ir"];
const ENDS = [
  "dor", "mar", "thia", "ria", "ran", "nor", "vane", "gard", "heim", "dia", "sus", "tan", "rak", "lon", "mir",
  "vaal", "dun", "wick", "stan", "goth", "mere", "vell", "rend", "kesh", "zar", "thos", "mund", "var", "ros", "nia",
  "garth", "holm", "vir", "dra", "lis", "tor", "quar", "bek", "hal", "thas", "vor", "dell", "carn", "mos", "ia",
];
// Some invented names come with a title.
const FORMS = [(n) => n, (n) => n, (n) => n, (n) => n, (n) => `${n} Dynasty`, (n) => `House ${n}`, (n) => `${n} Realm`, (n) => `${n} Khanate`];
// Share of nations that get an invented name even where historical ones remain.
const INVENTED_SHARE = 0.35;

function invent(rand) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const name = pick(STARTS) + pick(MIDDLES) + pick(ENDS);
  return pick(FORMS)(name);
}

// A name not in `used` for a nation spawning at [lon, lat]. `rand` returns [0, 1).
export function nationName([lon, lat], used, rand) {
  const region = REGIONS.find(([, test]) => test(lon, lat))?.[0];
  const free = (POOLS[region] ?? []).filter((n) => !used.has(n));
  if (free.length && rand() >= INVENTED_SHARE) return free[Math.floor(rand() * free.length)];
  for (let i = 0; i < 50; i++) {
    const name = invent(rand);
    if (!used.has(name)) return name;
  }
  return `Realm ${used.size + 1}`;
}
