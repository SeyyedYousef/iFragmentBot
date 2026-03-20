// ========================================================================================================
//   OMNI-SINGULARITY LEXICON — DOMAIN MODEL
// ========================================================================================================

const TIER_0_CORPORATE_GODS =
	`apple google amazon meta tesla spacex openai chatgpt microsoft netflix disney nike sony samsung visa telegram durov ton binance nvidia amazon paypal stripe mastercard intel amd qualcomm oracle adobe salesforce shopify vmware ibm hp dell lenovo asus github gitlab docker kubernetes reddit twitter instagram facebook whatsapp youtube tiktok snapchat spotify uber lyft airbnb dropbox slack zoom coinbase kraken gemini ftx robinhood schwab fidelity vanguard blackrock jpmorgan goldman sachs morgan citibank hsbc barclays deutsche bnp santander ubs credit suisse revolut nubank wise transferwise square block payoneer venmo zelle chime sofi webull etrade ameritrade ferrari lamborghini porsche bmw mercedes audi bentley rollsroyce maserati bugatti mclaren rolex omega cartier patek breitling iwc hublot audemars piguet gucci louis vuitton hermes chanel prada dior versace armani burberry balenciaga boeing airbus lockheed raytheon northrop general dynamics bae thales safran pfizer johnson moderna biontech roche novartis merck abbvie astrazeneca gilead exxon chevron shell bp total conocophillips cocacola pepsi nestle unilever procter kraft heinz mondelez danone kellogg walmart costco target macys nordstrom sephora ulta homedepot lowes mcdonalds starbucks chipotle subway dominos papa johns yum marriott hilton hyatt intercontinental wyndham accor united american delta southwest spirit jetblue alaska frontier verizon att tmobile sprint vodafone orange telefonica espn nba nfl mlb nhl fifa ufc wwe pga cnn foxnews msnbc bbc skynews reuters afp bloomberg`
		.split(/\s+/)
		.filter(Boolean);

const TIER_1_ATLAS =
	`usa uk uae iran russia china germany france japan india brazil canada australia mexico spain italy london paris dubai tehran moscow newyork berlin tokyo istanbul riyadh delhi mumbai shanghai beijing amsterdam stockholm oslo helsinki copenhagen dublin prague vienna budapest warsaw lisbon athens rome milan barcelona madrid zurich geneva singapore hongkong seoul taipei bangkok jakarta manila cairo johannesburg sydney melbourne toronto vancouver montreal chicago losangeles sanfrancisco miami houston dallas seattle boston phoenix denver atlanta detroit philadelphia charlotte nashville austin portland orlando tampa vegas denver saltlake albuquerque sacramento sandiego sanjose oakland berkeley stanford oxford cambridge harvard yale princeton columbia stanford berkeley mit caltech ucla usc nyu brown hawaii florida california texas arizona nevada colorado utah oregon washington newyork massachusetts england scotland wales ireland france spain portugal italy greece turkey poland ukraine sweden norway finland denmark netherlands belgium switzerland austria hungary romania serbia croatia bulgaria albania russia china japan korea vietnam thailand malaysia indonesia philippines singapore india pakistan egypt morocco algeria tunisia libya nigeria kenya southafrica brazil argentina chile colombia peru mexico canada cuba jamaica bahamas bermuda qatar bahrain kuwait oman yemen jordan lebanon syria iraq israel palestine afghanistan pakistan bangladesh nepal tibet mongolia taiwan macau arctic antarctic`
		.split(/\s+/)
		.filter(Boolean);

const TIER_2_WEALTH =
	`btc eth sol ada xrp bnb dot avax matic link atom ltc etc bch xlm vet trx eos near algo hbar fil icp mana sand axs gala enj chz flow lrc imx gmt apt sui arb op blur pepe shib doge floki bonk wif meme coin token crypto blockchain defi cefi dex cex amm swap pool stake yield farm airdrop whale hodl bull bear pump dump moon lambo ape diamond hands tendies gwei sats wei hash block mining miner nft dao ico ido ieo launchpad presale mint burn fork merge upgrade layer zk rollup bridge oracle wallet ledger trezor metamask trust phantom argent rainbow zerion zapper uniswap pancake sushi aave money cash gold silver platinum palladium diamond ruby sapphire emerald pearl opal jade obsidian gem rich wealth wealthy fortune treasure vault safe deposit account savings investment millionaire billionaire trillionaire richest forbes hundred thousand million billion trillion zillion quadrillion portfolio stock bond equity fund etf hedge venture capital private angel seed series ipo startup bank credit loan mortgage finance financial banking trading invest investor investing trader trade rare epic legendary mythic ultimate supreme iconic exclusive premium luxury elite vip vvip prestige collection collector collectible limited edition vintage antique classic original authentic genuine royal imperial crown throne kingdom empire dynasty noble aristocrat monarch sovereign majesty opulent lavish extravagant magnificent splendid majestic grand gorgeous stunning beautiful amazing dope fire lit based goat boss chief king queen prince princess lord lady duke baron count master infinite eternal immortal divine sacred cosmic quantum genesis alpha omega prime apex zenith pinnacle titan legend phantom shadow ghost spirit soul angel demon devil god goddess hero villain champion`
		.split(/\s+/)
		.filter(Boolean);

const TIER_3_PERSIAN =
	`tala sekeh seke zarb gold sika rial toman pul pool pooli pooldar servet servat sarrafi sarraf bourse shah soltan padshah shahi saltanat takht taj khorshid aslan shir palang babr yooz azhdeha phoenix eshgh ashk ashegh maadar pedar zan mard pesar dokhtar khahar baradar khandan khanevade famil hamsaye ziba zibayi zibarooy rangi gol bolbol ghoo mahi morg lak parande bahar tabestan paeez zemestan khabar akhbar news ruzname radio tv seda sima film cinema theatre namayesh honar sang music mosighi bazaar bazar kharid forush tejarat kasb kar karsaz kargah karkhane sanaat fanaari tech tekno digi bezan bazi game lotfi shans ghomar ghomarbaz bord khodro mashin otomobil motor bike saykl dacharke asb shahab saat zaman vaght emruz farda diruz hafteh maah sal gharn nour roshan khalij fars arabi irani iranian persia parsi arya aria koroush dariush khashayar ardeshir babak kaveh rostam sohrab dolar dollar arz exchange sarrafi crypto ramzarz bitcoin digital porshe benz bmv ferrari lambo`
		.split(/\s+/)
		.filter(Boolean);

const TIER_3_RUSSIAN =
	`piter moskva rossiya rus russki russky rossia russia soviet soyuz kreml kremlin tsar czar tzar imperator imperatrix korol koroleva prints printsessa knyaz boyar dvoryanin dvorets dvortsov dengi rubli rublei rubl dollar evro zlato zoloto serebro platina almaz brilliant izumrud zhemchug bogatstvo bogat bogatyi millioner milliard oligarh magnit tycoon baron graf gertsog konung neft gaz ugol stal zhelezo nikel medj alyuminiy titan uran plutoniy gazprom rosneft lukoil surgutneftegaz tatneft novatek sibur severstal nlmk magnitogorsk sberbank vtb alfa tinkoff rosbank gazprombank promsvyaz otkritie sovkombank raiffeisen aeroflot s7 pobeda ural utair rossiya nordwind smartavia azimut redwings lada kamaz gaz ural uaz moskvich zil avtotor sollers mts megafon beeline tele2 rostelekom rostelecom top vip lux premium elite exclusiv komfort biznes business luxe first class brat bratva vor gospodi bog angel demon dusha duh serdtse slovo slava mir pobeda sila vlast mosch derzhava rodina otechestvo novosti news gazeta zhurnal radio televizor kino film serial klip music muzyka pesnya`
		.split(/\s+/)
		.filter(Boolean);

const TIER_3_ARABIC =
	`habibi habibti sahib sahiba akh akhi ukhti ummi abi walid walida ibn bint aal sheikha sheikh emir emarat emirate sultan sultana melik melike malik malika amir amira khalifa khalifat dhahab dahab fidda platinum diamond lulu jawhar jawahir kanz kunuz thaman sarooh ghali dubai abudhabi sharjah ajman fujairah rasalkhaimah ummalquwain doha qatar bahrain kuwait jeddah riyadh makkah madinah dammam taif abha khobar jubail yanbu tabuk najran jazan burj khalifa marina downtown jumeirah palmjumeirah worldislands bluewaters yal nas creek alam emaar nakheel damac meraas aldar azizi sobha samana danube falcon saqr nasr eagle shaheen bird desert wahsh sahra camel jamal nakha faris horse arab khayl faras hisan asil arabian thoroughbred race derby cup gold silver bronze halal haram masjid quran sunnah hadith salat zakat sawm hajj umrah eid fitr adha mubarak ramadan muharram safar rabih jumada rajab shaban dhul qadah hijjah islamic muslim islam salam shukran jazak afwan marhaba ahlan inshallah mashallah alhamdulillah bismillah subhan majlis diwan dewaniya dewan mehman dawat ziyafa zaffat farah aras wedding henna mehndi`
		.split(/\s+/)
		.filter(Boolean);

const TIER_3_CHINESE =
	`long dragon phoenix fenghuang qilin tiger hu lion shi panda xiongmao crane he turtle gui snake she fa facai cai caiyun caishen fortune wealth luck xing xingyun jixiang prosperity wangcai hongbao red jin gold huang golden yin silver bai white hong red hei black lan blue lu green zi purple cheng orange shen shenme god spirit ling lingqi soul hun po xian immortal fo buddha dao tao qi chi energy gong kung wang king huang emperor di ti hou queen taizi prince gongzhu princess guizu noble junzi gentleman beijing shanghai guangzhou shenzhen hangzhou nanjing suzhou chengdu xian wuhan tianjin chongqing alibaba tencent baidu jd pinduoduo meituan bytedance huawei xiaomi oppo vivo lenovo dji haier weixin wechat weibo douyin kuaishou taobao tmall alipay zhifubao unionpay zhongguo china zhonghua huaxia han tang song yuan ming qing republic peoples yi er san si wu liu qi ba jiu shi bai qian wan yi zhao yao yingyao lucky fortune good hao hen henhao excellent bang bangde perfect youxiu outstanding ai love xi xihuan like qing qinggan feeling xin heart ling soul shen spirit ti body jian health kang mei meili beautiful shuai handsome ku cool piao liang pretty ke ai cute qin dear bao babe baobei baby danbao baozi jiaozi mian fan cha tang shui`
		.split(/\s+/)
		.filter(Boolean);

const TIER_3_LUCKY_NUMBERS =
	`888 666 168 188 288 388 488 588 688 788 988 111 222 333 444 555 777 999 1111 2222 3333 4444 5555 6666 7777 8888 9999 123 1234 12345 321 4321 54321 007 420 710 1337 1969 1984 2000 2001 2010 2020 2021 2022 2023 2024 2025 2030`
		.split(/\s+/)
		.filter(Boolean);

const TIER_3_TURKISH =
	`turk turkiye istanbul ankara izmir bursa antalya adana konya gaziantep kral reis baba anne kardes abi abla dayi amca dede nene aile aslan kartal kurt kanarya cimbom fener bjk gs ts trabzon spor ay yildiz gunes deniz dag ova nehir gol orman cicek gul lale can ask sevgi dost arkadas kanka guzel cirkin iyi kotu deli para altin gumus elmas zengin fakir patron mudur lider baskan oyun oyuncu kazan kaybet skor mac gol penalti kupa sampiyon savas baris asker ordu polis jandarma millet vatan bayrak`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_NATURE =
	`lion tiger bear wolf fox eagle hawk owl falcon raven crow dove swan duck goose peacock parrot shark whale dolphin octopus squid jellyfish lobster crab shrimp oyster clam coral reef seahorse snake cobra viper python dragon lizard gecko iguana crocodile alligator turtle tortoise elephant rhino hippo giraffe zebra cheetah leopard panther jaguar cougar puma lynx wildcat gorilla chimp monkey orangutan lemur sloth koala kangaroo wombat platypus buffalo bison moose elk deer stag antelope gazelle impala wildebeest horse pony donkey mule zebra camel llama alpaca dog puppy cat kitten bird feather wing nest egg fish fin whale shark dolphin seal rose lily tulip daisy sunflower orchid lotus jasmine lavender violet iris peony tree forest jungle rainforest woodland garden meadow field desert mountain valley sun moon star planet comet galaxy nebula universe cosmos space fire flame blaze ember ash spark light glow shine shadow water rain snow ice frost storm thunder lightning rainbow wind breeze gust gale hurricane tornado cyclone typhoon earth soil rock stone crystal mineral gem diamond gold silver`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_JOBS =
	`ceo cfo cto coo cmo cio founder cofounder president chairman director manager supervisor engineer developer programmer coder architect designer artist creator builder maker doctor nurse surgeon dentist therapist psychiatrist psychologist pharmacist veterinarian lawyer attorney judge prosecutor defender solicitor paralegal notary mediator arbitrator teacher professor instructor tutor coach mentor trainer educator dean principal scientist researcher physicist chemist biologist geneticist astronomer geologist economist statistician mathematician analyst planner strategist advisor consultant accountant auditor bookkeeper controller treasurer banker broker trader dealer agent salesman marketer advertiser publicist promoter spokesperson journalist reporter editor chef cook baker pastry sommelier bartender barista server waiter host hostess pilot captain navigator flight attendant mechanic technician maintenance driver trucker courier delivery messenger shipping logistics warehouse farmer rancher fisherman hunter forester gardener landscaper builder carpenter plumber electrician mason painter roofer security guard bouncer bodyguard detective investigator officer soldier sailor marine airman special forces ranger commando sniper firefighter paramedic emt rescue dispatcher operator coordinator clerk secretary receptionist assistant administrator executive`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_TECH =
	`web www http https ftp ssl tcp ip dns api rest graphql json xml html css javascript python java net network internet intranet vpn lan wan cloud server host domain website webpage portal app application software hardware firmware platform system windows linux mac ios android code program script compile debug test deploy monitor log profile optimize scale git github gitlab bitbucket version control branch merge pull push commit release agile scrum kanban sprint backlog story epic task bug feature hotfix patch update devops docker container kubernetes pod service deployment replica helm aws azure gcp google cloud alibaba digital ocean heroku vercel netlify frontend backend fullstack mobile desktop embedded iot edge serverless microservice bot chatbot ai ml dl nlp cv gan transformer gpt llm neural network deep learning crypto hash encrypt decrypt token jwt oauth sso mfa security firewall data database sql nosql mongodb redis elasticsearch analytics bigdata warehouse pixel byte bit megabyte gigabyte terabyte petabyte bandwidth latency throughput hack hacker hacking code coding coder programmer programming developer dev`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_SOCIAL =
	`love heart soul mate partner friend bestie bff squad crew gang tribe fam family home life live alive born death heaven hell angel demon god goddess devil spirit ghost king queen prince princess lord lady duke duchess baron knight noble royal boss chief head leader captain commander general admiral president minister rich poor wealth luxury comfort hustle grind work play rest sleep wake dream happy sad angry joy hope love hate peace war fight battle victory defeat win lose true real fake genuine authentic original copy clone twin duo pair trio fire ice hot cold warm cool chill freeze burn melt flow wave splash swim float fast slow quick rapid swift speedy rush pace tempo rhythm beat pulse shake high low up down top bottom peak base summit valley hill mountain cliff edge big small large tiny huge massive giant mini micro nano mega giga ultra new old young ancient vintage retro classic modern future past present eternal first last next final initial primary ultimate super extra special unique rare bright dark light shadow glow shine spark flash bang boom crash storm calm`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_VERBS =
	`run go do be have get make take see look find come think know want need feel give tell work try ask use help turn start show hear play move like live believe hold bring happen write stand pay meet include continue set learn change lead understand watch follow stop create speak read allow add spend grow open walk win offer remember love consider appear buy serve send expect build stay fall cut reach remain suggest raise pass sell require report decide link connect join split break fix solve destroy delete remove insert update edit copy paste cut move drag drop click tap swipe scroll zoom rotate flip mirror reverse push pull lift carry throw catch kick hit strike punch grab hold release drop raise lower fly jump leap hop skip bounce roll spin twist turn bend stretch extend contract expand sit stand lie sleep wake eat drink taste smell listen touch feel sense perceive think believe know understand remember forget learn teach train guide lead follow chase fight defend attack protect guard shield block dodge escape flee hide seek find discover`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_GAMING =
	`game gamer play player score point level stage round match tournament championship league cup win lose draw tie victory defeat champion winner loser mvp goat beast legend pro elite master noob newbie rookie veteran expert grandmaster diamond platinum gold silver bronze iron fps rpg mmo moba rts puzzle racing sports simulation strategy adventure action horror survival console pc mobile switch playstation xbox nintendo steam epic origin battlenet minecraft fortnite valorant league legends dota csgo overwatch apex warzone pubg call duty battlefield halo gears war assassin creed god war zelda mario pokemon twitch youtube stream chat subscriber follower donation emote esports team clan guild alliance faction sponsor jersey merch loot drop item gear weapon armor shield helm boot glove ring cape robe belt bag potion xp level hp mp str dex con int wis stat skill perk feat quest raid boss mob npc`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_FOOD =
	`food eat drink hungry thirsty meal breakfast lunch dinner brunch snack dessert fruit apple orange banana grape mango pineapple watermelon strawberry blueberry cherry vegetable carrot broccoli spinach lettuce tomato potato onion garlic pepper cucumber meat beef pork chicken turkey duck lamb fish salmon tuna shrimp lobster crab bread pasta noodle rice grain cheese milk cream butter yogurt egg bacon sausage steak burger pizza sushi sashimi ramen curry thai chinese japanese korean mexican italian french coffee tea espresso latte cappuccino mocha cold brew iced juice smoothie soda cola sprite pepsi water sparkling beer wine champagne vodka whiskey bourbon gin rum tequila cocktail chocolate vanilla caramel strawberry mint cookie brownie cake pie muffin cupcake donut ice cream gelato sorbet frozen yogurt sundae shake smoothie`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_CREATOR =
	`youtuber tiktoker streamer influencer vlogger podcaster creator`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_MUSIC =
	`music song track album single remix cover beat drop bass drum melody harmony rhythm tempo rock pop hip hop rap trap edm electronic dance house techno trance dubstep metal punk jazz blues guitar bass drums keyboard piano synthesizer violin cello trumpet saxophone flute harp dj producer mixer master engineer studio session recording live acoustic spotify apple music youtube tidal soundcloud bandcamp billboard chart hot trending viral playlist mix compilation hits throwback concert tour gig festival show performance live acoustic grammy mtv award gold platinum diamond certified singer rapper vocalist artist band group solo duo trio quartet orchestra lyrics verse chorus bridge hook intro outro fade loop sample`
		.split(/\s+/)
		.filter(Boolean);

const TIER_4_SPORTS =
	`sport football soccer basketball baseball hockey tennis golf boxing mma wrestling rugby cricket badminton volleyball handball polo lacrosse fencing archery cycling swimming running marathon sprint relay hurdles jump throw triathlon gym fitness workout exercise train lift weight cardio strength muscle abs chest back shoulder arm leg core bicep tricep yoga pilates crossfit hiit circuit interval stretching protein carb fat macro calorie diet keto paleo vegan bulk cut lean champion winner medal gold silver bronze trophy cup ring belt title team player coach manager agent scout draft trade sign contract league division conference playoff final semifinal round bracket record stat average percentage ratio rating rank point score goal assist shot dunk slam three pointer free throw layup jumper fadeaway`
		.split(/\s+/)
		.filter(Boolean);

const BIGRAM_SCORES = {
	th: 9,
	he: 9,
	in: 9,
	er: 9,
	an: 9,
	re: 9,
	on: 9,
	at: 9,
	en: 9,
	nd: 9,
	ti: 9,
	es: 9,
	or: 9,
	te: 9,
	of: 9,
	ed: 9,
	is: 9,
	it: 9,
	to: 9,
	io: 9,
	al: 8,
	ar: 8,
	st: 8,
	nt: 8,
	ng: 8,
	se: 8,
	ha: 8,
	as: 8,
	ou: 8,
	le: 8,
	ve: 8,
	co: 8,
	me: 8,
	de: 8,
	hi: 8,
	ri: 8,
	ro: 8,
	ic: 8,
	ne: 8,
	ea: 8,
	ce: 8,
	ly: 8,
	be: 8,
	el: 8,
	ta: 8,
	la: 8,
	ns: 8,
	di: 8,
	si: 8,
	li: 7,
	ch: 7,
	ll: 7,
	ma: 7,
	om: 7,
	ur: 7,
	ca: 7,
	fo: 7,
	ho: 7,
	pe: 7,
	ec: 7,
	pr: 7,
	no: 7,
	ct: 7,
	us: 7,
	rt: 7,
	ut: 7,
	nc: 7,
	tr: 7,
	ss: 7,
	rs: 7,
	sh: 7,
	oo: 7,
	ee: 7,
	ai: 7,
	ow: 7,
	da: 7,
	ay: 7,
	ge: 7,
	ol: 7,
	op: 7,
	do: 7,
	ra: 7,
	ke: 7,
	po: 7,
	mo: 7,
	lo: 7,
	so: 7,
	go: 7,
	bo: 7,
	qu: 6,
	ck: 6,
	ph: 6,
	wh: 6,
	wr: 5,
	kn: 5,
	pl: 6,
	bl: 6,
	cl: 6,
	fl: 6,
	gl: 6,
	sl: 6,
	cr: 6,
	dr: 6,
	fr: 6,
	gr: 6,
	br: 6,
	sp: 6,
	sc: 6,
	sk: 6,
	sm: 6,
	sn: 6,
	sw: 6,
	tw: 6,
	hy: 6,
	rh: 5,
	ym: 5,
	og: 6,
	fy: 6,
	dw: 4,
	gn: 4,
	pn: 4,
	ps: 5,
	pt: 5,
	bt: 4,
	ft: 5,
	lt: 5,
	mp: 5,
	nk: 5,
	lk: 4,
	lm: 4,
	ln: 4,
	ld: 5,
	lf: 4,
	lp: 4,
	mb: 5,
	aa: 3,
	ii: 2,
	uu: 2,
	oe: 4,
	ae: 4,
	eu: 4,
	ei: 5,
	ie: 5,
	uo: 3,
	ua: 4,
	qw: 2,
	jk: 1,
	kj: 1,
	vw: 1,
	xy: 3,
};

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);
const KEYBOARD_PATTERNS = [
	"qwerty",
	"qwert",
	"werty",
	"asdf",
	"asdfg",
	"zxcv",
	"zxcvb",
	"1234",
	"12345",
	"123456",
	"qwer",
	"asd",
	"zxc",
	"qaz",
	"wsx",
	"edc",
	"rfv",
	"tgb",
	"yhn",
	"ujm",
	"qazwsx",
	"wsxedc",
	"edcrfv",
	"1qaz",
	"2wsx",
	"3edc",
	"4rfv",
	"5tgb",
	"6yhn",
	"7ujm",
	"zaq",
	"xsw",
	"cde",
	"vfr",
	"bgt",
	"nhy",
	"mju",
	"poiuy",
	"lkjhg",
	"mnbvc",
];
const LEET_MAP = {
	0: "o",
	1: "i",
	2: "z",
	3: "e",
	4: "a",
	5: "s",
	6: "g",
	7: "t",
	8: "b",
	9: "g",
	"@": "a",
	$: "s",
	"!": "i",
	"+": "t",
};
const POWER_SUFFIXES = [
	"bot",
	"app",
	"io",
	"ai",
	"pro",
	"vip",
	"hub",
	"lab",
	"dev",
	"sys",
	"net",
	"pay",
	"way",
	"now",
	"eth",
	"sol",
	"btc",
	"ton",
	"dao",
	"nft",
	"defi",
	"swap",
	"dex",
	"fi",
	"coin",
	"cash",
	"org",
	"com",
	"inc",
	"ltd",
	"corp",
	"grp",
	"group",
	"intl",
	"global",
	"world",
	"usa",
	"uk",
	"club",
	"team",
	"fam",
	"gang",
	"squad",
	"army",
	"crew",
	"guild",
	"clan",
	"tribe",
	"nation",
	"base",
	"camp",
	"fort",
	"port",
	"bay",
	"city",
	"town",
	"land",
	"zone",
	"realm",
	"plus",
	"max",
	"ultra",
	"mega",
	"super",
	"prime",
	"elite",
	"gold",
	"platinum",
	"diamond",
	"tech",
	"soft",
	"ware",
	"code",
	"data",
	"cloud",
	"stack",
	"works",
	"forge",
	"craft",
	"labs",
	"ify",
	"ly",
	"ed",
	"er",
	"est",
	"tion",
	"ness",
	"ment",
	"able",
	"ible",
];
const POWER_PREFIXES = [
	"the",
	"my",
	"our",
	"get",
	"go",
	"hey",
	"hi",
	"mr",
	"ms",
	"dr",
	"sir",
	"king",
	"queen",
	"lord",
	"best",
	"top",
	"pro",
	"super",
	"ultra",
	"mega",
	"hyper",
	"max",
	"prime",
	"elite",
	"vip",
	"og",
	"global",
	"world",
	"inter",
	"intl",
	"euro",
	"asia",
	"us",
	"uk",
	"de",
	"fr",
	"jp",
	"cn",
	"ru",
	"pay",
	"cash",
	"coin",
	"crypto",
	"bit",
	"eth",
	"sol",
	"ton",
	"nft",
	"defi",
	"web3",
	"meta",
	"corp",
	"co",
	"inc",
	"uni",
	"multi",
	"all",
	"omni",
	"pan",
	"trans",
	"inter",
	"intra",
	"un",
	"re",
	"pre",
	"post",
	"anti",
	"pro",
	"non",
	"self",
	"semi",
	"auto",
	"bio",
	"geo",
	"neo",
];
const BRANDABLE_PATTERNS = [
	/^[a-z]{2,4}ly$/,
	/^[a-z]{2,4}ify$/,
	/^[a-z]{2,4}io$/,
	/^[a-z]{2,4}er$/,
	/^[a-z]{2,4}a$/,
	/^[a-z]{2,4}o$/,
	/^[a-z]+ex$/,
	/^[a-z]+ix$/,
	/^[a-z]+ax$/,
	/^[a-z]+oo$/,
];

export const Lexicon = {
	tier0: new Set(TIER_0_CORPORATE_GODS.map((w) => w.toLowerCase())),
	tier1: new Set(TIER_1_ATLAS.map((w) => w.toLowerCase())),
	tier2: new Set(TIER_2_WEALTH.map((w) => w.toLowerCase())),
	tier3Persian: new Set(TIER_3_PERSIAN.map((w) => w.toLowerCase())),
	tier3Russian: new Set(TIER_3_RUSSIAN.map((w) => w.toLowerCase())),
	tier3Arabic: new Set(TIER_3_ARABIC.map((w) => w.toLowerCase())),
	tier3Chinese: new Set(TIER_3_CHINESE.map((w) => w.toLowerCase())),
	tier3Turkish: new Set(TIER_3_TURKISH.map((w) => w.toLowerCase())),
	tier3Lucky: new Set(TIER_3_LUCKY_NUMBERS),
	tier4Nature: new Set(TIER_4_NATURE.map((w) => w.toLowerCase())),
	tier4Jobs: new Set(TIER_4_JOBS.map((w) => w.toLowerCase())),
	tier4Tech: new Set(TIER_4_TECH.map((w) => w.toLowerCase())),
	tier4Social: new Set(TIER_4_SOCIAL.map((w) => w.toLowerCase())),
	tier4Verbs: new Set(TIER_4_VERBS.map((w) => w.toLowerCase())),
	tier4Creator: new Set(TIER_4_CREATOR.map((w) => w.toLowerCase())),
	tier4Gaming: new Set(TIER_4_GAMING.map((w) => w.toLowerCase())),
	tier4Food: new Set(TIER_4_FOOD.map((w) => w.toLowerCase())),
	tier4Music: new Set(TIER_4_MUSIC.map((w) => w.toLowerCase())),
	tier4Sports: new Set(TIER_4_SPORTS.map((w) => w.toLowerCase())),

	checkTier(word) {
		const w = word.toLowerCase();
		if (this.tier0.has(w))
			return { tier: 0, context: "Corporate God", multiplier: 100 };
		if (this.tier1.has(w))
			return { tier: 1, context: "Geographic Elite", multiplier: 30 };
		if (this.tier2.has(w))
			return { tier: 2, context: "Wealth/Premium", multiplier: 20 };
		if (this.tier3Persian.has(w))
			return { tier: 3, context: "Persian Market", multiplier: 15 };
		if (this.tier3Russian.has(w))
			return { tier: 3, context: "Russian Market", multiplier: 15 };
		if (this.tier3Arabic.has(w))
			return { tier: 3, context: "Arabic Market", multiplier: 15 };
		if (this.tier3Chinese.has(w))
			return { tier: 3, context: "Chinese Market", multiplier: 15 };
		if (this.tier3Turkish.has(w))
			return { tier: 3, context: "Turkish Market", multiplier: 15 };
		if (this.tier3Lucky.has(w))
			return { tier: 3, context: "Lucky Number", multiplier: 12 };
		if (this.tier4Creator.has(w))
			return { tier: 4, context: "Creator Economy", multiplier: 8 };
		if (this.tier4Nature.has(w))
			return { tier: 4, context: "Nature/Animals", multiplier: 8 };
		if (this.tier4Jobs.has(w))
			return { tier: 4, context: "Professional", multiplier: 6 };
		if (this.tier4Tech.has(w))
			return { tier: 4, context: "Technology", multiplier: 8 };
		if (this.tier4Social.has(w))
			return { tier: 4, context: "Social/Lifestyle", multiplier: 5 };
		if (this.tier4Verbs.has(w))
			return { tier: 4, context: "Action/Verb", multiplier: 4 };
		if (this.tier4Gaming.has(w))
			return { tier: 4, context: "Gaming/Esports", multiplier: 6 };
		if (this.tier4Food.has(w))
			return { tier: 4, context: "Food/Beverage", multiplier: 4 };
		if (this.tier4Music.has(w))
			return { tier: 4, context: "Music/Entertainment", multiplier: 5 };
		if (this.tier4Sports.has(w))
			return { tier: 4, context: "Sports/Fitness", multiplier: 5 };
		return { tier: 5, context: "Unknown", multiplier: 1 };
	},

	analyzeFlow(word) {
		if (!word || word.length < 2) return 0.5;
		const clean = word.toLowerCase().replace(/[^a-z]/g, "");
		if (clean.length < 2) return 0.2;
		let bigramScore = 0;
		let pairs = 0;
		for (let i = 0; i < clean.length - 1; i++) {
			const pair = clean.slice(i, i + 2);
			bigramScore +=
				BIGRAM_SCORES[pair] !== undefined ? BIGRAM_SCORES[pair] : 4;
			pairs++;
		}
		const avgBigram = pairs > 0 ? bigramScore / pairs / 9.0 : 0.5;
		let vowelCount = 0;
		for (const char of clean) if (VOWELS.has(char)) vowelCount++;
		const balanceScore = 1 - Math.abs(0.38 - vowelCount / clean.length) * 2;
		let maxConsecutive = 1;
		let current = 1;
		for (let i = 1; i < clean.length; i++) {
			if (VOWELS.has(clean[i - 1]) === VOWELS.has(clean[i])) {
				current++;
				maxConsecutive = Math.max(maxConsecutive, current);
			} else current = 1;
		}
		const consecutivePenalty =
			maxConsecutive > 3 ? 0.7 : maxConsecutive > 2 ? 0.9 : 1.0;
		let brandBonus = 1.0;
		for (const pattern of BRANDABLE_PATTERNS) {
			if (pattern.test(clean)) {
				brandBonus = 1.3;
				break;
			}
		}
		return Math.max(
			0,
			Math.min(
				1,
				(avgBigram * 0.5 + balanceScore * 0.3 + consecutivePenalty * 0.2) *
					brandBonus,
			),
		);
	},

	decodeLeet(word) {
		let decoded = word.toLowerCase();
		for (const [leet, char] of Object.entries(LEET_MAP))
			decoded = decoded.split(leet).join(char);
		return decoded;
	},

	detectKeyboardPattern(word) {
		const lower = word.toLowerCase();
		for (const pattern of KEYBOARD_PATTERNS)
			if (lower.includes(pattern))
				return { isPattern: true, patternName: `Keyboard: ${pattern}` };
		return { isPattern: false, patternName: null };
	},

	detectCombo(word) {
		if (word.length < 6) return { isCombo: false, parts: [], value: 1 };
		for (let i = 3; i < word.length - 2; i++) {
			const p1 = word.slice(0, i),
				p2 = word.slice(i);
			const t1 = this.checkTier(p1),
				t2 = this.checkTier(p2);
			if (t1.tier <= 4 && t2.tier <= 4)
				return {
					isCombo: true,
					parts: [p1, p2],
					value: Math.max(t1.multiplier, t2.multiplier) * 1.5,
				};
		}
		return { isCombo: false, parts: [], value: 1 };
	},

	isPalindrome(word) {
		const c = word.toLowerCase().replace(/[^a-z0-9]/g, "");
		return c === c.split("").reverse().join("") && c.length > 2;
	},

	detectGoldenYear(word) {
		const m = word.match(/(19[89]\d|20[0-3]\d)/);
		return m
			? { hasYear: true, year: parseInt(m[1], 10) }
			: { hasYear: false, year: null };
	},

	detectTechPattern(word) {
		if (/^[01]+$/.test(word) && word.length >= 4)
			return { isTechPattern: true, type: "Binary" };
		if (/^[0-9a-f]+$/i.test(word) && word.length === 6)
			return { isTechPattern: true, type: "Hex Color" };
		if (/^(.)\1+$/.test(word) && word.length >= 4)
			return { isTechPattern: true, type: "Solid Pattern" };
		return { isTechPattern: false, type: null };
	},

	detectAffixes(word) {
		const lower = word.toLowerCase();
		let bonus = 1;
		const details = [];
		for (const s of POWER_SUFFIXES)
			if (lower.endsWith(s) && lower.length > s.length + 2) {
				bonus *= 1.3;
				details.push(`+${s}`);
				break;
			}
		for (const p of POWER_PREFIXES)
			if (lower.startsWith(p) && lower.length > p.length + 2) {
				bonus *= 1.2;
				details.push(`${p}+`);
				break;
			}
		return { bonus, details };
	},

	isPronounceable(word) {
		const clean = word.toLowerCase().replace(/[^a-z]/g, "");
		if (clean.length < 2) return false;
		if (![...clean].some((c) => VOWELS.has(c))) return false;
		return !/[bcdfghjklmnpqrstvwxz]{5,}|^[bcdfghjklmnpqrstvwxz]{4,}/.test(
			clean,
		);
	},
};
