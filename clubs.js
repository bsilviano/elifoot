// Clubes por país/divisão (APROXIMADO: temporada 2025/26 de memória; a rotina de dados corrige depois).
// A ordem da lista é do mais forte para o mais fraco (usada só para estimar a força inicial).
(function (root) {
  const COUNTRIES = {
    BRA: { name: "Brasil", base: 66, promo: 4, fans: 1.0 },
    ARG: { name: "Argentina", base: 63, promo: 3, fans: 0.8 },
    GER: { name: "Alemanha", base: 72, promo: 2, fans: 1.2 },
    ENG: { name: "Inglaterra", base: 74, promo: 3, fans: 1.4 },
    ESP: { name: "Espanha", base: 73, promo: 3, fans: 1.1 },
    POR: { name: "Portugal", base: 66, promo: 2, fans: 0.6 },
    ITA: { name: "Itália", base: 72, promo: 3, fans: 1.0 },
    FRA: { name: "França", base: 68, promo: 2, fans: 0.8 }
  };
  const L = (key, country, tier, name, clubs) => ({ key, country, tier, name, clubs });
  const LEAGUES = [
    L("BRA1", "BRA", 1, "Série A", ["Flamengo","Palmeiras","Botafogo","Fluminense","Vasco","Corinthians","São Paulo","Santos","Grêmio","Internacional","Cruzeiro","Atlético-MG","Bahia","Fortaleza","Athletico-PR","Bragantino","Vitória","Mirassol","Coritiba","Chapecoense"]),
    L("BRA2", "BRA", 2, "Série B", ["Sport","Ceará","Goiás","Avaí","Novorizontino","Criciúma","Cuiabá","Juventude","Operário-PR","Vila Nova","CRB","Athletic-MG","América-MG","Ponte Preta","Botafogo-SP","Paysandu","Amazonas","Ferroviária","Londrina","Atlético-GO"]),
    L("BRA3", "BRA", 3, "Série C", ["Figueirense","Náutico","Santa Cruz","Brusque","Volta Redonda","Confiança","Ituano","Guarani","ABC","Floresta","São Bernardo","Caxias","Botafogo-PB","Tombense","Anápolis","Itabaiana","Manaus","Aparecidense","Ypiranga-RS","Inter de Limeira"]),
    L("ARG1", "ARG", 1, "Liga Profesional", ["River Plate","Boca Juniors","Racing Club","Independiente","San Lorenzo","Estudiantes LP","Vélez Sarsfield","Talleres","Lanús","Argentinos Juniors","Rosario Central","Newell's Old Boys","Defensa y Justicia","Huracán","Belgrano","Godoy Cruz","Gimnasia LP","Platense","Tigre","Banfield"]),
    L("ARG2", "ARG", 2, "Primera Nacional", ["Colón","Unión","Atlético Tucumán","Quilmes","Chacarita","Almirante Brown","Ferro","All Boys","Nueva Chicago","Temperley","San Martín (T)","Instituto","Aldosivi","Estudiantes RC","Gimnasia Mendoza","Patronato","San Martín SJ","Atlanta","Morón","Deportivo Maipú"]),
    L("GER1", "GER", 1, "Bundesliga", ["Bayern de Munique","Borussia Dortmund","Bayer Leverkusen","RB Leipzig","Eintracht Frankfurt","VfB Stuttgart","Borussia Mönchengladbach","Werder Bremen","Wolfsburg","Freiburg","Hoffenheim","Mainz 05","Augsburg","Union Berlin","St. Pauli","Heidenheim","Colônia","Hamburgo"]),
    L("GER2", "GER", 2, "2. Bundesliga", ["Schalke 04","Hertha Berlim","Hannover 96","Fortuna Düsseldorf","Nürnberg","Kaiserslautern","Karlsruher SC","Paderborn","Magdeburg","Greuther Fürth","Elversberg","Darmstadt","Holstein Kiel","Braunschweig","Preußen Münster","Arminia Bielefeld","Dynamo Dresden","Bochum"]),
    L("ENG1", "ENG", 1, "Premier League", ["Liverpool","Arsenal","Manchester City","Chelsea","Newcastle","Aston Villa","Nottingham Forest","Brighton","Bournemouth","Brentford","Fulham","Crystal Palace","Everton","West Ham","Tottenham","Manchester United","Wolverhampton","Sunderland","Leeds United","Burnley"]),
    L("ENG2", "ENG", 2, "Championship", ["Leicester","Southampton","Ipswich","West Bromwich","Norwich","Sheffield United","Sheffield Wednesday","Middlesbrough","Coventry","Stoke City","Swansea","Watford","Bristol City","Millwall","Preston","Blackburn","QPR","Hull City","Derby County","Portsmouth","Oxford United","Birmingham City","Charlton","Wrexham"]),
    L("ESP1", "ESP", 1, "La Liga", ["Real Madrid","Barcelona","Atlético de Madrid","Athletic Bilbao","Real Sociedad","Villarreal","Betis","Sevilla","Valencia","Girona","Celta de Vigo","Osasuna","Getafe","Rayo Vallecano","Mallorca","Alavés","Espanyol","Levante","Elche","Real Oviedo"]),
    L("ESP2", "ESP", 2, "Segunda División", ["Racing Santander","Deportivo La Coruña","Málaga","Almería","Granada","Las Palmas","Sporting Gijón","Real Valladolid","Cádiz","Eibar","Burgos","Castellón","Córdoba","Zaragoza","Albacete","Mirandés","Huesca","Leganés","Cultural Leonesa","Andorra","Real Sociedad B","Ceuta"]),
    L("POR1", "POR", 1, "Primeira Liga", ["Benfica","Porto","Sporting CP","Braga","Vitória de Guimarães","Famalicão","Estoril","Gil Vicente","Moreirense","Casa Pia","Rio Ave","Santa Clara","Arouca","Nacional","Estrela da Amadora","Farense","AVS","Alverca"]),
    L("POR2", "POR", 2, "Liga Portugal 2", ["Marítimo","Boavista","Académico de Viseu","Leixões","Penafiel","Tondela","Vizela","Paços de Ferreira","Portimonense","Académica","Torreense","Feirense","Chaves","Oliveirense","Mafra","Desportivo Aves","União de Leiria","Benfica B"]),
    L("ITA1", "ITA", 1, "Serie A", ["Inter de Milão","Milan","Juventus","Napoli","Atalanta","Roma","Lazio","Fiorentina","Bologna","Torino","Udinese","Genoa","Cagliari","Como","Parma","Lecce","Verona","Sassuolo","Pisa","Cremonese"]),
    L("ITA2", "ITA", 2, "Serie B", ["Palermo","Sampdoria","Venezia","Monza","Bari","Spezia","Frosinone","Cesena","Modena","Juve Stabia","Empoli","Catanzaro","Cittadella","Reggiana","Mantova","Padova","Südtirol","Carrarese","Avellino","Pescara"]),
    L("FRA1", "FRA", 1, "Ligue 1", ["PSG","Marseille","Monaco","Lille","Lyon","Nice","Lens","Rennes","Strasbourg","Brest","Toulouse","Nantes","Auxerre","Angers","Le Havre","Lorient","Metz","Paris FC"]),
    L("FRA2", "FRA", 2, "Ligue 2", ["Saint-Étienne","Montpellier","Reims","Troyes","Guingamp","Rodez","Pau","Laval","Red Star","Annecy","Amiens","Dunkerque","Grenoble","Clermont","Bastia","Nancy","Le Mans","Martigues"])
  ];
  // Vagas continentais: [liga, posição inicial, posição final]
  const CUPS = {
    UCL: { name: "Champions League", prize: 2000000, slots: [["ENG1",1,4],["ESP1",1,4],["ITA1",1,4],["GER1",1,4],["FRA1",1,3],["POR1",1,3]] },
    UEL: { name: "Europa League", prize: 800000, slots: [["ENG1",5,6],["ESP1",5,6],["ITA1",5,6],["GER1",5,6],["FRA1",4,5],["POR1",4,5]] },
    UECL: { name: "Conference League", prize: 400000, slots: [["ENG1",7,8],["ESP1",7,8],["ITA1",7,8],["GER1",7,8],["FRA1",6,7],["POR1",6,7]] },
    LIB: { name: "Libertadores", prize: 1000000, slots: [["BRA1",1,6],["ARG1",1,6]] },
    SUL: { name: "Sul-Americana", prize: 400000, slots: [["BRA1",7,12],["ARG1",7,12]] }
  };
  // Estaduais dos estados dos clubes da Série A. Formato simplificado: todos contra todos (turno único),
  // depois mata-mata de jogo único (ko = quantos classificados). Listas de memória, aproximadas.
  const STATES = [
    { key: "SP", name: "Paulistão", ko: 8, clubs: ["Palmeiras","Corinthians","São Paulo","Santos","Bragantino","Mirassol","Novorizontino","Ponte Preta","Guarani","Ituano","Botafogo-SP","Ferroviária","Inter de Limeira","São Bernardo","Portuguesa","Velo Clube"] },
    { key: "RJ", name: "Carioca", ko: 4, clubs: ["Flamengo","Botafogo","Fluminense","Vasco","Volta Redonda","Madureira","Bangu","Boavista","Nova Iguaçu","Sampaio Corrêa-RJ","Portuguesa-RJ","Maricá"] },
    { key: "MG", name: "Mineiro", ko: 4, clubs: ["Cruzeiro","Atlético-MG","América-MG","Athletic-MG","Tombense","Pouso Alegre","Uberlândia","Democrata-GV","Villa Nova","Ipatinga","Caldense","Itabirito"] },
    { key: "RS", name: "Gaúcho", ko: 4, clubs: ["Grêmio","Internacional","Juventude","Caxias","Ypiranga-RS","Brasil de Pelotas","São Luiz","Guarany de Bagé","Avenida","Novo Hamburgo","Gaúcho","Esportivo"] },
    { key: "BA", name: "Baiano", ko: 4, clubs: ["Bahia","Vitória","Bahia de Feira","Jacuipense","Juazeirense","Atlético de Alagoinhas","Barcelona de Ilhéus","Porto-BA","Vitória da Conquista","Jequié"] },
    { key: "CE", name: "Cearense", ko: 4, clubs: ["Fortaleza","Ceará","Ferroviário","Floresta","Iguatu","Maracanã","Caucaia","Horizonte","Pacajus","Tirol"] },
    { key: "PR", name: "Paranaense", ko: 4, clubs: ["Athletico-PR","Coritiba","Operário-PR","Londrina","Cianorte","Maringá","Azuriz","Andraus","Rio Branco-PR","FC Cascavel","Toledo","São Joseense"] },
    { key: "SC", name: "Catarinense", ko: 4, clubs: ["Chapecoense","Avaí","Figueirense","Brusque","Criciúma","Joinville","Marcílio Dias","Hercílio Luz","Concórdia","Barra-SC","Próspera","Camboriú"] }
  ];
  const data = { COUNTRIES, LEAGUES, CUPS, STATES };
  if (typeof module !== "undefined") module.exports = data; else root.ClubData = data;
})(typeof window !== "undefined" ? window : globalThis);
