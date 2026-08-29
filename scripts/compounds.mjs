// Drift v3 chain builder: every link is a LEXICAL UNIT — a closed compound
// (racetrack) or a dictionary-tight two-word collocation (coffee bean).
// PAIRS is the curated asset; the solver finds the longest cycle through it.
// Each pair: [a, b, style] where style 0 = closed "ab", 1 = spaced "a b",
// or an explicit display string ("tug of war"). Edges are usable in either
// direction; the display unit is always as authored.
// Run: node scripts/compounds.mjs   — writes data/chain.json.

import { writeFileSync } from "node:fs";

const PAIRS = [
  // coffee / kitchen / food
  ["coffee","bean",1],["coffee","table",1],["coffee","cup",1],["coffee","shop",1],["coffee","break",1],
  ["bean","bag",1],["bean","stalk",0],["string","bean",1],["jelly","bean",1],
  ["tea","pot",0],["tea","party",1],["tea","spoon",0],["green","tea",1],
  ["cup","cake",0],["butter","cup",0],["world","cup",1],
  ["pan","cake",0],["cheese","cake",0],["fruit","cake",0],["birthday","cake",1],["cake","walk",0],
  ["ginger","bread",0],["bread","basket",1],["corn","bread",0],["bread","crumb",0],["short","bread",0],
  ["butter","fly",0],["butter","milk",0],["peanut","butter",1],["butter","knife",1],
  ["milk","shake",0],["milk","man",0],["coconut","milk",1],
  ["egg","shell",0],["egg","plant",0],["egg","head",0],["nest","egg",1],["egg","roll",1],
  ["hot","dog",1],["hot","sauce",1],["hot","spring",1],["hot","seat",1],
  ["dog","house",0],["watch","dog",0],["dog","tag",1],["corn","dog",1],
  ["pop","corn",0],["corn","field",0],["candy","corn",1],
  ["candy","cane",1],["cotton","candy",1],["candy","bar",1],
  ["sugar","cane",1],["sugar","rush",1],["brown","sugar",1],
  ["honey","moon",0],["honey","comb",0],["honey","bee",0],
  ["bee","hive",0],["spelling","bee",1],["queen","bee",1],
  ["salt","water",1],["rock","salt",1],["salt","shaker",1],
  ["pepper","mint",0],["bell","pepper",1],["chili","pepper",1],
  ["mint","condition",1],["spear","mint",0],
  ["apple","pie",1],["apple","sauce",0],["pine","apple",0],["apple","orchard",1],["candy","apple",1],
  ["pie","chart",1],["pumpkin","pie",1],["humble","pie",1],
  ["pumpkin","patch",1],["pumpkin","spice",1],
  ["spice","rack",1],
  ["grape","fruit",0],["grape","vine",0],
  ["vine","yard",0],
  ["fruit","punch",1],["fruit","salad",1],
  ["punch","line",1],["punching","bag",1],
  ["salad","bar",1],["salad","dressing",1],
  ["sandwich","board",1],["club","sandwich",1],["knuckle","sandwich",1],
  ["lunch","box",0],["lunch","break",1],["lunch","hour",1],
  ["dinner","party",1],["dinner","bell",1],["dinner","plate",1],
  ["soup","kitchen",1],["soup","spoon",1],["chicken","soup",1],
  ["kitchen","sink",1],["kitchen","counter",1],
  ["chicken","coop",1],["chicken","wing",1],["rubber","chicken",1],
  ["wish","bone",0],["wishing","well",1],
  ["cheese","burger",0],["swiss","cheese",1],["cheese","wheel",1],
  ["ham","burger",0],["ham","string",0],
  ["pickle","jar",1],["cookie","jar",1],["cookie","dough",1],["cookie","cutter",1],
  ["dough","nut",0],
  ["nut","shell",0],["nut","cracker",0],["pea","nut",0],["chest","nut",0],
  ["ice","cream",1],["cream","cheese",1],["whipped","cream",1],
  ["ice","berg",0],["ice","cube",0],["ice","age",1],["dry","ice",1],["ice","pick",1],["ice","rink",1],
  ["short","rib",1],["rib","eye",1],["rib","cage",1],
  ["sweet","tooth",1],["sweet","potato",1],["sweet","corn",1],["sweet","spot",1],
  ["couch","potato",1],["potato","chip",1],["mashed","potato",1],
  ["chip","shot",1],["poker","chip",1],["chocolate","chip",1],
  ["chocolate","bar",1],["hot","chocolate",1],
  ["wine","glass",1],["wine","cellar",1],
  ["olive","oil",1],["olive","branch",1],
  ["oil","lamp",1],["oil","spill",1],["motor","oil",1],
  // household / objects
  ["table","tennis",1],["table","spoon",0],["pool","table",1],["picnic","table",1],["table","cloth",0],
  ["tennis","court",1],["tennis","ball",1],["tennis","elbow",1],
  ["court","yard",0],["court","house",0],["basketball","court",1],
  ["yard","stick",0],["back","yard",0],["ship","yard",0],["junk","yard",0],
  ["stick","figure",1],["lip","stick",0],["candle","stick",0],["chop","stick",0],["drum","stick",0],["broom","stick",0],["walking","stick",1],
  ["lip","service",1],["lip","gloss",1],
  ["service","station",1],["room","service",1],["secret","service",1],
  ["gas","station",1],["fire","station",1],["train","station",1],["space","station",1],["radio","station",1],
  ["gas","mask",1],["gas","pedal",1],["gas","tank",1],
  ["face","mask",1],["ski","mask",1],["mask","tape",-1],
  ["face","value",1],["poker","face",1],["clock","face",1],["baby","face",1],["face","paint",1],
  ["clock","work",0],["clock","tower",1],["alarm","clock",1],["grandfather","clock",1],["cuckoo","clock",1],
  ["work","shop",0],["home","work",0],["work","bench",0],["team","work",0],["paper","work",0],["guess","work",0],["patch","work",0],["wood","work",0],["metal","work",0],["needle","work",0],["work","horse",0],
  ["shop","keeper",0],["barber","shop",0],["pawn","shop",1],["shop","lifter",0],
  ["goal","keeper",0],["zoo","keeper",0],["book","keeper",0],["bee","keeper",0],["light","keeper",-1],
  ["goal","post",0],["goal","line",1],
  ["post","card",0],["post","office",1],["lamp","post",0],["fence","post",1],["post","mark",0],
  ["card","board",0],["credit","card",1],["card","trick",1],["wild","card",1],["report","card",1],
  ["board","walk",0],["board","game",1],["chalk","board",0],["surf","board",0],["diving","board",1],["bill","board",0],["skate","board",0],["key","board",0],["score","board",0],["dash","board",0],
  ["side","walk",0],["side","kick",0],["side","show",0],["blind","side",0],["side","door",1],["bed","side",0],["sea","side",0],["country","side",0],
  ["kick","stand",0],["drop","kick",0],["kick","boxing",0],
  ["rain","drop",0],["dew","drop",0],["gum","drop",0],["drop","cloth",1],
  ["rain","bow",0],["rain","coat",0],["rain","forest",0],["rain","check",1],["rain","dance",1],
  ["bow","tie",1],["ribbon","bow",-1],
  ["neck","tie",0],["neck","lace",0],["turtle","neck",0],["bottle","neck",0],
  ["shoe","lace",0],["lace","curtain",1],
  ["horse","shoe",0],["snow","shoe",0],["shoe","box",0],["shoe","shine",0],
  ["horse","power",0],["horse","back",0],["rocking","horse",1],["race","horse",0],["sea","horse",0],["dark","horse",1],["horse","play",0],
  ["power","plant",1],["power","nap",1],["will","power",0],["power","tool",1],["solar","power",1],
  ["free","will",1],["free","fall",0],["free","throw",1],["free","style",0],
  ["life","style",0],["life","guard",0],["life","boat",0],["life","jacket",1],["life","line",0],["life","time",0],["night","life",0],["wild","life",0],["shelf","life",1],["still","life",1],
  ["body","guard",0],["body","language",1],["body","builder",0],
  ["guard","rail",0],["guard","tower",1],["crossing","guard",1],
  ["sign","language",1],["stop","sign",1],["neon","sign",1],["sign","post",0],["peace","sign",1],
  ["stop","watch",0],["bus","stop",1],["pit","stop",1],["truck","stop",1],["rest","stop",1],
  ["watch","tower",0],["wrist","watch",0],["night","watch",0],["pocket","watch",1],
  ["dog","sled",1],["sled","hill",-1],
  ["house","boat",0],["tree","house",0],["bird","house",0],["light","house",0],["green","house",0],["farm","house",0],["club","house",0],["full","house",1],["haunted","house",1],["house","plant",1],["open","house",1],["house","key",1],
  ["tree","top",0],["palm","tree",1],["family","tree",1],["tree","trunk",1],["apple","tree",1],["pine","tree",1],["tree","ring",1],
  ["palm","reader",1],
  ["branch","office",1],["bank","branch",1],
  ["bank","vault",1],["river","bank",0],["piggy","bank",1],["blood","bank",1],["bank","robber",1],
  ["river","bed",0],["river","boat",0],["river","side",0],
  ["bed","room",0],["bed","time",0],["bed","rock",0],["flower","bed",1],["bed","bug",0],["bunk","bed",1],["bed","spread",0],["sea","bed",0],["death","bed",0],
  ["flower","pot",1],["sun","flower",0],["flower","shop",1],["may","flower",0],["wild","flower",0],["flower","girl",1],
  ["sun","set",0],["sun","rise",0],["sun","shine",0],["sun","burn",0],["sun","screen",0],["sun","dial",0],["sun","roof",0],["sun","beam",0],["sun","spot",0],["sun","bath",-1],
  ["jet","lag",1],["jet","engine",1],["jet","stream",1],["jumbo","jet",1],["jet","ski",1],
  ["time","zone",1],["time","capsule",1],["time","machine",1],["time","bomb",1],["lunch","time",0],["spring","time",0],["nap","time",0],["over","time",0],["time","table",0],["day","time",0],["night","time",0],["time","travel",1],
  ["comfort","zone",1],["comfort","food",1],["end","zone",1],
  ["food","chain",1],["food","truck",1],["food","court",1],["junk","food",1],["food","fight",1],["fast","food",1],
  ["chain","saw",0],["key","chain",0],["chain","reaction",1],["chain","link",1],["daisy","chain",1],
  ["key","note",0],["key","hole",0],["key","ring",1],["monkey","key",-1],["skeleton","key",1],["low","key",1],
  ["note","book",0],["note","pad",0],["love","note",1],["sticky","note",1],
  ["book","worm",0],["cook","book",0],["text","book",0],["book","shelf",0],["book","case",0],["scrap","book",0],["book","mark",0],["year","book",0],["story","book",0],["phone","book",1],["comic","book",1],["book","club",1],
  ["worm","hole",0],["earth","worm",0],["silk","worm",0],["glow","worm",0],
  ["silk","road",1],["silk","scarf",1],
  ["road","trip",1],["road","map",1],["road","block",0],["dirt","road",1],["road","sign",1],["cross","road",0],
  ["trip","wire",0],["guilt","trip",1],["field","trip",1],
  ["wire","tap",0],["barbed","wire",1],["high","wire",1],["wire","fence",1],["live","wire",1],
  ["tap","dance",1],["tap","water",1],["tap","shoe",1],
  ["dance","floor",1],["dance","partner",1],["barn","dance",1],["dance","move",1],
  ["floor","plan",1],["ocean","floor",1],["floor","lamp",1],["ground","floor",1],
  ["game","plan",1],["video","game",1],["game","show",1],["game","night",1],["ball","game",1],["game","changer",1],["waiting","game",1],
  ["music","video",1],["video","camera",1],["video","call",1],
  ["sheet","music",1],["music","box",1],["folk","music",1],
  ["spread","sheet",0],["bed","sheet",1],["cheat","sheet",1],["balance","sheet",1],
  ["eagle","eye",1],["eagle","scout",1],["spread","eagle",1],
  ["eye","ball",0],["eye","brow",0],["eye","lash",0],["eye","lid",0],["bird","eye",-1],["black","eye",1],["eye","contact",1],["eye","candy",1],["eye","witness",0],["bull","eye",-1],["eye","drop",1],["eye","chart",1],
  ["ball","room",0],["ball","park",0],["base","ball",0],["basket","ball",0],["foot","ball",0],["snow","ball",0],["fire","ball",0],["meat","ball",0],["curve","ball",0],["pin","ball",0],["gum","ball",0],["cannon","ball",0],["ball","point",0],["beach","ball",1],["bowling","ball",1],["crystal","ball",1],["disco","ball",1],["wrecking","ball",1],
  ["room","mate",0],["living","room",1],["locker","room",1],["waiting","room",1],["room","key",1],["elbow","room",1],["mush","room",0],
  ["class","mate",0],["class","room",0],["class","action",1],["first","class",1],["class","clown",1],
  ["action","figure",1],["action","movie",1],["action","hero",1],
  ["father","figure",1],["figure","skating",1],["figure","eight",1],
  ["land","mark",0],["land","slide",0],["land","lord",0],["dream","land",0],["farm","land",0],["land","mine",0],["waste","land",0],["mother","land",0],["homeland","security",-1],
  ["question","mark",1],["birth","mark",0],["trade","mark",0],["mark","down",-1],
  ["pop","quiz",1],["pop","star",1],["soda","pop",1],["pop","art",1],
  ["quiz","show",1],["quiz","night",1],
  ["corn","maze",1],["corn","husk",1],
  ["snap","shot",0],["ginger","snap",0],["snap","pea",1],["cold","snap",1],["snap","judgment",1],
  ["gun","shot",0],["gun","powder",0],["water","gun",1],["gun","smoke",0],["glue","gun",1],["nerf","gun",-1],["staple","gun",1],
  ["powder","room",1],["baby","powder",1],["powder","keg",1],
  ["baby","boom",1],["baby","step",1],["baby","tooth",1],["baby","shower",1],["cry","baby",0],
  ["boom","box",0],["sonic","boom",1],
  ["box","office",1],["box","car",0],["sand","box",0],["mail","box",0],["tool","box",0],["juke","box",0],["match","box",0],["cereal","box",1],["box","spring",1],["tackle","box",1],
  ["break","fast",0],["break","dance",0],["heart","break",0],["break","room",1],["spring","break",1],["prison","break",1],["big","break",1],["tie","break",-1],
  ["heart","beat",0],["heart","burn",0],["sweet","heart",0],["heart","attack",1],["broken","heart",1],["heart","strings",-1],
  ["drum","beat",0],["ear","drum",0],["drum","roll",1],["drum","kit",1],["bass","drum",1],
  ["ear","ring",0],["ear","muff",0],["ear","lobe",0],["ear","wax",0],["dog","ear",1],
  ["ring","tone",0],["ring","finger",1],["boxing","ring",1],["ring","leader",0],["onion","ring",1],["wedding","ring",1],["ring","master",0],
  ["boxing","glove",1],["boxing","match",1],
  ["day","dream",0],["birth","day",0],["day","light",0],["day","break",0],["pay","day",0],["snow","day",1],["day","camp",1],["rainy","day",1],
  ["dream","team",1],["dream","catcher",0],["dream","job",1],["pipe","dream",1],["dream","house",1],
  ["team","captain",1],["tag","team",1],["team","spirit",1],
  ["price","tag",1],["name","tag",1],["tag","along",-1],
  ["half","price",1],["price","check",1],
  ["half","moon",1],["half","pipe",1],["better","half",1],["half","dollar",1],
  ["moon","light",0],["moon","walk",0],["full","moon",1],["moon","beam",0],["moon","rock",1],["harvest","moon",1],["moon","shot",0],
  ["comb","over",-1],["fine","comb",-1],
  ["hive","mind",1],
  ["mind","reader",1],["master","mind",0],["mind","game",1],["mind","map",1],
  ["master","piece",0],["master","key",1],["master","plan",1],["grand","master",0],["master","class",0],
  ["piece","meal",0],["puzzle","piece",1],["conversation","piece",1],["piece","keeper",-1],
  ["jigsaw","puzzle",1],["puzzle","box",1],["cross","word",0],
  ["word","play",1],["word","search",1],["pass","word",0],["buzz","word",0],["word","smith",0],["swear","word",1],["key","word",0],
  ["play","ground",0],["play","house",0],["play","list",0],["horse","play",-2],["play","pen",0],["play","date",0],["fair","play",1],["play","dough",1],["screen","play",0],["power","play",1],
  ["ground","hog",0],["ground","water",-1],["camp","ground",0],["under","ground",-1],["battle","ground",0],["back","ground",0],["common","ground",1],
  ["camp","fire",0],["camp","site",0],["summer","camp",1],["base","camp",1],
  ["fire","fly",0],["fire","place",0],["fire","wood",0],["fire","drill",1],["fire","truck",1],["fire","escape",1],["wild","fire",0],["fire","alarm",1],["cease","fire",0],["fire","pit",1],["camp","out",-1],
  ["boot","camp",1],["boot","strap",0],["ski","boot",1],["cowboy","boot",1],["boot","print",1],
  ["ski","lift",1],["ski","slope",1],["ski","jump",1],["water","ski",1],["ski","lodge",1],["ski","pole",1],
  ["water","fall",0],["water","melon",0],["water","wheel",1],["water","slide",1],["water","tower",1],["water","bottle",1],["water","balloon",1],["water","color",0],["salt","shake",-1],["holy","water",1],["water","proof",0],
  ["fall","guy",1],["night","fall",0],["pit","fall",0],["foot","hill",0],["free","range",1],
  ["night","club",1],["night","owl",1],["night","mare",0],["night","shift",1],["night","light",1],["mid","night",0],["night","stand",0],["over","night",-1],["night","gown",0],["school","night",1],
  ["club","soda",1],["golf","club",1],["night","cap",0],["fan","club",1],
  ["owl","pellet",-1],
  ["head","ache",0],["head","line",0],["head","phone",0],["head","band",0],["head","light",0],["head","master",0],["arrow","head",0],["red","head",0],["hammer","head",0],["air","head",0],["head","stone",0],["spear","head",0],["knuckle","head",0],["head","start",1],["head","count",1],["bone","head",0],["head","room",0],
  ["tooth","ache",0],["tooth","brush",0],["tooth","paste",0],["tooth","pick",0],["tooth","fairy",1],["wisdom","tooth",1],
  ["stomach","ache",0],["upset","stomach",1],
  ["couch","cushion",1],["couch","surfing",1],
  ["pin","cushion",0],["safety","pin",1],["pin","wheel",0],["pin","point",0],["clothes","pin",0],["pin","stripe",0],["rolling","pin",1],["bowling","pin",1],["pin","drop",1],
  ["safety","net",1],["safety","first",1],
  ["net","fishing",-1],["fishing","net",1],["fish","net",0],["hair","net",1],["net","gain",1],["butterfly","net",1],
  ["fishing","rod",1],["fishing","line",1],["fishing","boat",1],["fly","fishing",1],["fishing","hook",1],["fishing","trip",1],
  ["lightning","rod",1],["lightning","bug",1],["lightning","bolt",1],["lightning","storm",1],["lightning","round",1],
  ["bug","spray",1],["bed","bug",-2],["fire","bug",0],["lady","bug",0],["litter","bug",0],["stomach","bug",1],
  ["litter","box",1],
  ["kitty","litter",1],["kitty","corner",1],["kitty","pool",-1],
  ["corner","store",1],["corner","pocket",1],["corner","office",1],["street","corner",1],["corner","kick",1],
  ["pocket","knife",1],["pocket","change",1],["pick","pocket",0],["pocket","money",1],
  ["jack","knife",0],["jack","pot",0],["jack","hammer",0],["lumber","jack",0],["jack","rabbit",0],["car","jack",1],["flap","jack",0],
  ["pot","hole",1],["pot","luck",0],["flower","pot",-2],["pot","pie",1],["melting","pot",1],["pot","roast",1],["crack","pot",0],["jack","pot",-2],["pot","gold",-3],
  ["black","hole",1],["black","berry",0],["black","board",0],["black","smith",0],["black","bird",0],["black","out",-1],["black","belt",1],["black","market",1],["pitch","black",1],["black","sheep",1],
  ["berry","patch",1],["straw","berry",0],["blue","berry",0],
  ["eye","patch",1],["patch","quilt",-1],
  ["roof","top",0],["roof","rack",1],["tin","roof",1],
  ["top","hat",1],["top","spin",0],["big","top",1],["laptop","top",-1],["tip","top",1],["top","secret",1],["mountain","top",0],["spinning","top",1],["tree","top",-2],["carrot","top",1],
  ["spinning","wheel",1],["wheel","chair",0],["wheel","barrow",0],["steering","wheel",1],["hamster","wheel",1],["ferris","wheel",1],["wagon","wheel",1],["cart","wheel",0],["big","wheel",1],
  ["hamster","cage",1],["bird","cage",0],["cage","fight",1],
  ["short","cut",0],["hair","cut",0],["cut","throat",0],["paper","cut",1],["cut","corner",-1],["crew","cut",1],["clear","cut",1],
  ["hair","brush",0],["hair","pin",0],["hair","spray",1],["hair","dryer",1],["hair","style",0],["curly","hair",1],["hair","salon",1],["hair","band",1],["horse","hair",0],["hair","tie",1],
  ["paint","brush",0],["war","paint",1],["paint","roller",1],["finger","paint",1],["spray","paint",1],["paint","thinner",1],["oil","paint",1],
  ["war","zone",1],["war","ship",0],["tug","war",-4],["war","hero",1],["cold","war",1],["war","drum",1],["price","war",1],["war","path",0],
  ["tug","boat",0],
  ["boat","house",-2],["row","boat",0],["sail","boat",0],["speed","boat",0],["steam","boat",0],["boat","ride",1],["dream","boat",0],["gravy","boat",1],
  ["sail","cloth",0],["main","sail",0],
  ["row","house",0],["death","row",1],["front","row",1],
  ["death","trap",1],["death","valley",1],["sudden","death",1],["death","wish",1],
  ["mouse","trap",0],["trap","door",-2],["speed","trap",1],["tourist","trap",1],["bear","trap",1],["sand","trap",1],["booby","trap",1],
  ["church","mouse",1],["mouse","pad",1],["field","mouse",1],["mouse","hole",1],
  ["church","bell",1],["church","choir",1],["church","steeple",1],
  ["bell","tower",1],["dumb","bell",0],["door","bell",0],["bell","hop",0],["cow","bell",0],["bell","curve",1],["jingle","bell",1],["bell","bottom",1],["liberty","bell",1],
  ["rock","star",1],["rock","band",1],["rock","climbing",1],["rock","garden",1],["punk","rock",1],["rock","bottom",1],["rocking","chair",1],["rock","concert",1],["pet","rock",1],
  ["star","fish",0],["star","light",0],["star","dust",0],["shooting","star",1],["star","gazing",1],["movie","star",1],["star","struck",0],["north","star",1],["star","power",1],
  ["sword","fish",0],["sword","fight",1],["cat","fish",0],["jelly","fish",0],["fish","bowl",0],["fish","tank",1],["gold","fish",0],["fish","market",1],["fish","hook",0],["fish","scale",1],["puffer","fish",1],
  ["pillow","fight",1],["pillow","case",0],["pillow","talk",1],["throw","pillow",1],["pillow","fort",1],
  ["talk","show",1],["small","talk",1],["pep","talk",1],["trash","talk",1],["baby","talk",1],["sleep","talk",-1],
  ["show","case",-2],["show","time",0],["magic","show",1],["show","boat",0],["puppet","show",1],["show","room",0],["talent","show",1],["light","show",1],["horror","show",1],
  ["basket","case",1],["picnic","basket",1],["laundry","basket",1],["gift","basket",1],["waste","basket",0],["bread","basket",-2],
  ["picnic","blanket",1],["security","blanket",1],["blanket","fort",1],["wet","blanket",1],["electric","blanket",1],
  ["security","camera",1],["security","deposit",1],["job","security",1],
  ["camera","crew",1],["camera","lens",1],["camera","angle",1],
  ["flash","flood",1],["flash","light",-2],["flash","card",1],["news","flash",1],["flash","mob",1],["hot","flash",1],
  ["flood","gate",0],["flood","light",0],["flood","plain",0],
  ["gate","way",0],["tail","gate",0],["gate","keeper",0],["garden","gate",1],["starting","gate",1],
  ["pony","tail",0],["tail","spin",0],["tail","wind",0],["tail","light",0],["cocktail","tail",-1],["dove","tail",0],["tail","feather",1],["fairy","tale",-5],
  ["pony","ride",1],["pony","express",1],
  ["spin","doctor",1],["spin","class",1],["spin","cycle",1],
  ["witch","doctor",1],["witch","hunt",1],["witch","craft",0],["witch","hat",1],
  ["hunt","treasure",-6],["scavenger","hunt",1],["job","hunt",1],["house","hunting",-1],["bargain","hunt",-1],
  ["treasure","chest",1],["treasure","map",1],["treasure","island",1],["buried","treasure",1],
  ["chest","pain",1],["war","chest",1],["chest","press",1],["hope","chest",1],["toy","chest",1],
  ["sea","shell",0],["shell","shock",1],["turtle","shell",1],["shell","game",1],["snail","shell",1],
  ["sea","shore",0],["sea","weed",0],["sea","salt",1],["sea","sick",0],["sea","gull",0],["deep","sea",1],["sea","breeze",1],["sea","turtle",1],["sea","level",1],["sea","monster",1],
  ["shore","line",0],["sure","shore",-1],
  ["news","paper",0],["news","stand",0],["news","anchor",1],["fake","news",1],["news","room",0],["breaking","news",1],
  ["paper","clip",1],["paper","trail",1],["fly","paper",0],["paper","airplane",1],["wall","paper",0],["sand","paper",0],["paper","towel",1],["paper","route",1],["paper","weight",0],["term","paper",1],["paper","boy",0],["tissue","paper",1],["paper","kite",-7],
  ["band","stand",0],["rubber","band",1],["band","wagon",0],["marching","band",1],["band","aid",1],["one-man","band",-1],
  ["rubber","duck",1],["rubber","glove",1],["burnt","rubber",-1],["rubber","stamp",1],
  ["duck","pond",1],["duck","feet",-1],["sitting","duck",1],["duck","hunt",1],
  ["pond","scum",1],["fish","pond",1],["pond","skater",-1],
  ["wagon","train",1],["covered","wagon",1],["welcome","wagon",1],
  ["train","track",1],["train","wreck",1],["freight","train",1],["train","conductor",1],["gravy","train",1],["train","whistle",1],
  ["race","track",0],["track","suit",0],["track","record",1],["sound","track",0],["track","meet",1],["track","star",1],["fast","track",1],["railroad","track",1],["track","field",-8],
  ["record","player",1],["record","label",1],["record","deal",1],["world","record",1],["record","store",1],["broken","record",1],
  ["player","piano",1],["team","player",1],["player","coach",1],
  ["piano","key",1],["piano","teacher",1],["grand","piano",1],["piano","bar",1],["piano","bench",1],
  ["suit","case",0],["swim","suit",0],["suit","jacket",1],["space","suit",1],["business","suit",1],["bathing","suit",1],["law","suit",0],["suit","tie",-9],
  ["case","study",1],["court","case",1],["cold","case",1],["case","file",1],["charging","case",1],
  ["swim","lane",1],["swimming","pool",1],["swim","cap",1],["swim","meet",1],
  ["pool","party",1],["pool","hall",1],["car","pool",0],["pool","shark",1],["tide","pool",1],["gene","pool",1],["wading","pool",1],
  ["party","hat",1],["party","favor",1],["block","party",1],["party","trick",1],["pool","noodle",1],["party","animal",1],["surprise","party",1],["party","bus",1],
  ["hat","trick",1],["hard","hat",1],["straw","hat",1],["cowboy","hat",1],["chef","hat",1],
  ["hard","ware",-1],["hard","hat",-2],["hard","drive",1],["die","hard",0],["hard","candy",1],["hard","rock",1],
  ["drive","way",0],["test","drive",1],["drive","thru",-1],["four-wheel","drive",-1],["sunday","drive",-1],
  ["way","side",0],["high","way",0],["milky","way",1],["run","way",0],["water","way",0],["one","way",1],["subway","way",-1],["hall","way",0],["door","way",-2],["walk","way",0],
  ["high","school",1],["high","five",1],["high","noon",1],["high","tide",1],["knee","high",1],["high","chair",1],["high","dive",1],["sky","high",1],["high","horse",1],
  ["school","bus",1],["school","yard",0],["old","school",1],["school","teacher",1],["fish","school",-10],["school","bell",1],["school","house",0],
  ["bus","driver",1],["bus","ticket",1],["double-decker","bus",-1],["tour","bus",1],
  ["ticket","stub",1],["ticket","booth",1],["lottery","ticket",1],["parking","ticket",1],["golden","ticket",1],["speeding","ticket",1],
  ["booth","phone",-11],["photo","booth",1],["toll","booth",1],["voting","booth",1],
  ["photo","album",1],["photo","shoot",1],["photo","finish",1],["photo","bomb",0],
  ["album","cover",1],["family","album",1],
  ["cover","letter",1],["cloud","cover",1],["under","cover",-1],["book","cover",1],["cover","band",1],["man","hole",-12],
  ["letter","opener",1],["love","letter",1],["capital","letter",1],["chain","letter",1],
  ["love","story",1],["love","song",1],["puppy","love",1],["love","seat",1],["true","love",1],["love","triangle",1],
  ["story","time",1],["bedtime","story",1],["ghost","story",1],["short","story",1],["cover","story",1],["success","story",1],
  ["song","bird",0],["theme","song",1],["swan","song",1],["folk","song",1],
  ["bird","bath",1],["bird","feeder",1],["bird","watching",1],["early","bird",1],["bird","nest",1],["mocking","bird",0],["bird","dog",1],["thunder","bird",0],["snow","bird",0],
  ["bath","tub",0],["bath","robe",0],["bubble","bath",1],["bath","towel",1],["bird","seed",0],["mud","bath",1],
  ["tub","thumping",-1],["hot","tub",1],
  ["bubble","gum",1],["bubble","wrap",1],["bubble","bee",-13],["soap","bubble",1],["bubble","tea",1],
  ["gum","tree",1],["chewing","gum",1],
  ["soap","opera",1],["soap","box",0],["soap","dish",1],["bar","soap",1],
  ["opera","house",1],["opera","singer",1],["rock","opera",1],
  ["dish","washer",0],["dish","towel",1],["satellite","dish",1],["dish","soap",1],["side","dish",1],["petri","dish",1],
  ["washing","machine",1],["car","wash",1],["wash","cloth",0],["brain","wash",0],["mouth","wash",0],["white","wash",0],
  ["machine","gun",1],["sewing","machine",1],["vending","machine",1],["pinball","machine",1],["slot","machine",1],
  ["brain","storm",0],["brain","freeze",1],["brain","teaser",1],["bird","brain",0],["brain","power",1],["scatter","brain",0],
  ["storm","cloud",1],["thunder","storm",0],["sand","storm",0],["storm","chaser",1],["dust","storm",1],["perfect","storm",1],["storm","drain",1],["snow","storm",0],["fire","storm",0],
  ["cloud","nine",1],["mushroom","cloud",1],["cloud","burst",0],["dust","cloud",1],["dark","cloud",1],
  ["nine","lives",1],["nine","iron",1],
  ["iron","fist",1],["iron","curtain",1],["waffle","iron",1],["ironing","board",1],["iron","will",1],["pumping","iron",1],["cast","iron",1],["iron","horse",1],
  ["fist","bump",1],["fist","fight",1],
  ["bump","road",-14],["speed","bump",1],["goose","bump",1],["fender","bump",-1],
  ["goose","chase",1],["goose","egg",1],["mother","goose",1],["silly","goose",1],
  ["chase","scene",1],["car","chase",1],["paper","chase",1],
  ["scene","crime",-15],["crime","scene",1],["scene","stealer",1],
  ["crime","wave",1],["crime","boss",1],["true","crime",1],["partner","crime",-16],
  ["wave","length",0],["heat","wave",1],["tidal","wave",1],["sound","wave",1],["micro","wave",0],["wave","pool",1],["radio","wave",1],
  ["heat","stroke",1],["heat","lamp",1],["dead","heat",1],["heat","map",1],
  ["stroke","luck",-17],["brush","stroke",1],["back","stroke",-2],["breast","stroke",0],["key","stroke",0],
  ["luck","charm",-18],["lady","luck",1],["beginner","luck",-19],["dumb","luck",1],["luck","draw",-20],
  ["charm","bracelet",1],["charm","school",1],["snake","charmer",-1],["third","time","charm",-1],
  ["bracelet","watch",-1],["friendship","bracelet",1],["ankle","bracelet",1],
  ["snake","oil",1],["snake","pit",1],["snake","eyes",1],["garden","snake",1],["snake","skin",1],["rattle","snake",0],
  ["pit","crew",1],["pit","bull",1],["fire","pit",-2],["mosh","pit",1],["peach","pit",1],["arm","pit",0],["tar","pit",1],
  ["bull","dozer",0],["bull","frog",0],["bull","fight",1],["bull","market",1],["bull","horn",0],["china","bull",-21],["bull","ring",1],["mechanical","bull",1],["bull","pen",0],
  ["frog","leg",1],["leap","frog",0],["frog","prince",1],["tree","frog",1],
  ["leg","room",1],["leg","warmer",1],["chicken","leg",1],["table","leg",1],["peg","leg",1],["leg","work",-2],
  ["horn","section",1],["fog","horn",0],["french","horn",1],["horn","rimmed",-1],["bull","horn",-2],["horn","player",1],
  ["fog","machine",1],["fog","lamp",1],["brain","fog",1],["morning","fog",1],
  ["morning","person",1],["morning","glory",1],["good","morning",1],["morning","dew",1],["sunday","morning",-1],["morning","coffee",1],["morning","paper",1],
  ["person","interest",-22],["people","person",1],["person","hour",-1],
  ["glory","days",-1],["glory","hole",-1],["old","glory",1],
  ["dew","point",1],["mountain","dew",-1],
  ["point","guard",1],["point","blank",1],["match","point",1],["turning","point",1],["point","break",1],["boiling","point",1],["bullet","point",1],["focal","point",1],["melting","point",1],["needle","point",0],["view","point",0],["pin","point",-2],["west","point",-1],["exclamation","point",1],
  ["guard","dog",1],["security","guard",1],["mouth","guard",1],["old","guard",1],["shin","guard",1],["national","guard",1],
  ["blank","check",1],["blank","stare",1],["blank","slate",1],["fill","blank",-23],
  ["check","list",0],["check","mark",1],["check","point",0],["reality","check",1],["check","mate",0],["spell","check",1],["gut","check",1],["background","check",1],["sound","check",1],["double","check",1],["safety","check",1],["coat","check",1],
  ["list","price",1],["bucket","list",1],["wish","list",1],["waiting","list",1],["shopping","list",1],["guest","list",1],["grocery","list",1],["laundry","list",1],
  ["bucket","hat",1],["rust","bucket",1],["bucket","seat",1],
  ["hat","rack",1],["thinking","cap",1],["night","hat",-24],
  ["rack","lamb",-25],["towel","rack",1],["luggage","rack",1],["bike","rack",1],["gun","rack",1],
  ["lamb","chop",1],["lamb","wool",-26],
  ["chop","shop",1],["pork","chop",1],["karate","chop",1],
  ["shop","talk",1],["gift","shop",1],["thrift","shop",1],["shop","window",1],["print","shop",1],["shop","class",1],["candy","shop",1],["window","shop",-1],
  ["gift","card",1],["gift","wrap",1],["gift","horse",1],["birthday","gift",1],
  ["wrap","sheet",-27],["gift","bag",1],["plastic","wrap",1],["rap","sheet",-1],["wrap","party",1],
  ["bag","pipe",0],["sleeping","bag",1],["grab","bag",1],["trash","bag",1],["tote","bag",1],["duffel","bag",1],["brown","bag",1],["air","bag",0],["bag","lady",1],["tea","bag",1],["mixed","bag",1],["shopping","bag",1],
  ["pipe","organ",1],["peace","pipe",1],["pipe","cleaner",1],["wind","pipe",0],["pipe","line",-2],["bag","tag",-28],
  ["organ","donor",1],["organ","grinder",1],
  ["wind","mill",0],["wind","chime",1],["whirl","wind",0],["wind","tunnel",1],["second","wind",1],["wind","sock",1],["down","wind",-1],["wind","shield",0],["head","wind",0],["wind","surfing",0],
  ["mill","stone",0],["mill","pond",1],["rumor","mill",1],["pepper","mill",1],["saw","mill",0],["run","mill",-29],["paper","mill",1],
  ["stone","wall",0],["stepping","stone",1],["stone","age",1],["cobble","stone",0],["lime","stone",0],["gall","stone",0],["gem","stone",0],["tomb","stone",0],["curb","stone",0],["kidney","stone",1],["skipping","stone",1],["rolling","stone",1],
  ["wall","flower",0],["wall","street",1],["brick","wall",1],["wall","clock",1],["climbing","wall",1],["fire","wall",0],["wall","socket",1],["stone","cold",-30],
  ["street","light",1],["street","smart",1],["main","street",1],["one-way","street",-1],["street","performer",1],["easy","street",1],["street","food",1],["side","street",1],
  ["smart","phone",1],["smart","cookie",1],["book","smart",1],["smart","aleck",1],
  ["phone","booth",1],["phone","call",1],["cell","phone",1],["phone","charger",1],["pay","phone",1],["phone","tag",1],["speaker","phone",1],
  ["call","center",1],["curtain","call",1],["roll","call",1],["wake-up","call",-1],["bird","call",1],["cat","call",0],["close","call",1],["house","call",1],["judgment","call",1],["cold","call",1],
  ["center","stage",1],["shopping","center",1],["town","center",1],["dead","center",1],["nerve","center",1],["center","field",1],
  ["stage","fright",1],["stage","door",1],["stage","name",1],["world","stage",1],["stage","crew",1],["landing","stage",-1],
  ["fright","night",-31],["stage","whisper",1],
  ["name","brand",1],["nick","name",0],["name","calling",1],["maiden","name",1],["pen","name",1],["household","name",1],["middle","name",1],["name","dropper",1],
  ["brand","new",1],["brand","loyalty",1],["branding","iron",1],
  ["new","year",1],["new","moon",1],["good","news",-32],["new","leaf",1],
  ["year","round",1],["light","year",1],["leap","year",1],["school","year",1],["gap","year",1],["golden","year",-1],
  ["round","table",1],["round","trip",1],["merry-go","round",-1],["round","robin",1],["boxing","round",1],
  ["trip","fall",-33],["power","trip",1],["ego","trip",1],
  ["robin","hood",-1],["robin","egg",-87],
  ["hood","ornament",1],["neighbor","hood",0],["child","hood",0],["brother","hood",0],["hood","winked",-1],
  ["neighbor","fence",-34],["next-door","neighbor",-1],["neighborhood","watch",-1],
  ["fence","sitter",1],["picket","fence",1],["electric","fence",1],["chain-link","fence",-1],
  ["picket","line",1],["picket","sign",1],
  ["electric","guitar",1],["electric","eel",1],["electric","car",1],["electric","chair",1],["electric","current",1],
  ["guitar","string",1],["guitar","pick",1],["guitar","solo",1],["air","guitar",1],["bass","guitar",1],["guitar","hero",1],
  ["string","cheese",1],["string","quartet",1],["shoe","string",0],["heart","string",-35],["string","theory",1],["apron","string",-1],["purse","string",-1],["kite","string",1],["string","instrument",1],["puppet","string",-1],
  ["cheese","grater",1],["mac","cheese",-36],["cheese","platter",1],["say","cheese",1],["cheddar","cheese",1],
  ["kite","surfing",0],["box","kite",1],["kite","runner",1],["kite","festival",1],
  ["quartet","barbershop",-1],
  ["hero","worship",1],["super","hero",0],["hero","sandwich",1],["folk","hero",1],["unsung","hero",1],["local","hero",1],
  ["solo","artist",1],["solo","act",1],["solo","flight",1],
  ["artist","studio",-37],["con","artist",1],["makeup","artist",1],["escape","artist",1],["sketch","artist",1],["trapeze","artist",1],
  ["studio","apartment",1],["recording","studio",1],["art","studio",1],["dance","studio",1],["studio","audience",1],
  ["apartment","building",1],["apartment","complex",1],
  ["building","block",1],["body","building",-2],["team","building",1],["building","inspector",1],
  ["block","party",-2],["city","block",1],["stumbling","block",1],["cinder","block",1],["chip","block",-38],["mental","block",1],["butcher","block",1],["sun","block",0],["writer","block",-39],
  ["city","hall",1],["city","limits",-1],["capital","city",1],["city","slicker",1],["big","city",1],["inner","city",1],["city","lights",-1],
  ["hall","fame",-40],["music","hall",1],["study","hall",1],["hall","monitor",1],["town","hall",1],["hall","pass",1],["concert","hall",1],["dance","hall",1],
  ["fame","fortune",-41],["claim","fame",-42],
  ["fortune","cookie",1],["fortune","teller",1],["soldier","fortune",-43],["small","fortune",1],
  ["cookie","monster",-1],["girl","scout","cookie",-1],["smart","cookie",-2],["tough","cookie",1],
  ["monster","truck",1],["monster","movie",1],["cookie","crumb",-44],["sea","monster",-2],["green-eyed","monster",-1],
  ["truck","driver",1],["dump","truck",1],["tow","truck",1],["pickup","truck",1],["truck","bed",1],["ice-cream","truck",-1],
  ["driver","seat",-45],["taxi","driver",1],["slave","driver",1],["screw","driver",0],["back-seat","driver",-1],["golf","driver",1],
  ["seat","belt",1],["hot","seat",-2],["window","seat",1],["front","seat",1],["car","seat",1],["booster","seat",1],["bleacher","seat",-1],
  ["belt","buckle",1],["tool","belt",1],["conveyor","belt",1],["seat","cushion",1],["championship","belt",1],["fan","belt",1],
  ["buckle","shoe",-46],["swash","buckler",-1],
  ["tool","shed",1],["tool","kit",0],["power","tool",-2],["garden","tool",1],
  ["shed","light",-47],["garden","shed",1],["wood","shed",0],["snake","shed",-1],
  ["garden","hose",1],["garden","gnome",1],["rock","garden",-2],["garden","party",1],["victory","garden",1],["zen","garden",1],["botanical","garden",1],["secret","garden",1],["garden","variety",1],
  ["hose","water",-48],["fire","hose",1],["panty","hose",0],["hose","nozzle",1],
  ["gnome","lawn",-49],["lawn","gnome",1],
  ["lawn","mower",1],["lawn","chair",1],["lawn","dart",1],["front","lawn",1],
  ["mower","blade",-50],
  ["chair","lift",1],["arm","chair",0],["chair","man",0],["folding","chair",1],["deck","chair",1],["musical","chair",1],["beach","chair",1],["lounge","chair",1],
  ["lift","ticket",1],["face","lift",1],["heavy","lifting",-1],["fork","lift",0],
  ["fork","road",-51],["pitch","fork",0],["tuning","fork",1],["salad","fork",1],["fork","knife",-52],
  ["pitch","perfect",1],["sales","pitch",1],["pitch","dark",-53],["elevator","pitch",1],["wild","pitch",1],["pitcher","mound",-1],
  ["perfect","game",1],["perfect","pitch",-2],["picture","perfect",1],["perfect","match",1],["perfect","crime",1],
  ["picture","frame",1],["picture","book",1],["motion","picture",1],["big","picture",1],["picture","day",1],
  ["frame","mind",-54],["door","frame",1],["freeze","frame",1],["bike","frame",1],["window","frame",1],
  ["mind","matter",-55],["peace","mind",-56],["never","mind",1],["mind","blowing",-1],["open","mind",1],
  ["matter","fact",-57],["gray","matter",1],["subject","matter",1],["laughing","matter",1],
  ["fact","check",1],["fun","fact",1],["fact","finder",1],
  ["fun","house",0],["fun","fair",0],["fun","run",1],["poking","fun",-1],["fun","size",1],
  ["run","away",-1],["home","run",1],["trial","run",1],["run","down",-1],["marathon","run",-1],["dry","run",1],["end","run",1],["chicken","run",1],["bull","run",1],
  ["home","town",0],["home","sick",0],["home","made",0],["home","plate",1],["home","base",1],["home","field",1],["nursing","home",1],["home","stretch",1],["mobile","home",1],["home","team",1],
  ["town","square",1],["ghost","town",1],["town","crier",1],["down","town",0],["old","town",1],["town","gossip",1],
  ["square","dance",1],["square","meal",1],["square","root",1],["town","fair",-58],["square","foot",1],["fair","square",-59],["public","square",1],
  ["dance","recital",1],["rain","dance",-2],["victory","dance",1],["slow","dance",1],["dance","battle",1],
  ["root","beer",1],["root","canal",1],["square","peg",1],["root","cause",1],["grass","root",-60],["tree","root",1],
  ["beer","garden",1],["beer","belly",1],["ginger","beer",1],["beer","pong",1],
  ["belly","button",1],["belly","flop",1],["belly","dancer",1],["pot","belly",1],["belly","ache",0],
  ["button","hole",0],["button","nose",1],["panic","button",1],["belly","laugh",1],["snooze","button",1],["push","button",1],
  ["nose","dive",0],["nose","ring",1],["nose","bleed",0],["brown","nose",1],["nose","job",1],["runny","nose",1],
  ["dive","bar",1],["swan","dive",1],["deep","dive",1],["dumpster","dive",-1],["scuba","dive",-1],
  ["bar","stool",1],["bar","code",0],["crow","bar",0],["candy","bar",-2],["monkey","bar",1],["space","bar",1],["bar","tender",0],["sand","bar",0],["bar","graph",1],["salad","bar",-2],["handle","bar",0],
  ["stool","pigeon",1],["step","stool",1],["milking","stool",1],
  ["pigeon","hole",0],["carrier","pigeon",1],["clay","pigeon",1],["pigeon","toed",-1],
  ["code","name",1],["code","word",1],["zip","code",1],["dress","code",1],["secret","code",1],["morse","code",1],["code","red",1],["area","code",1],
  ["word","mouth",-61],["four-letter","word",-1],["magic","word",1],["word","choice",1],["household","word",1],["last","word",1],
  ["mouth","piece",0],["big","mouth",1],["motor","mouth",1],["loud","mouth",1],["river","mouth",1],["word","salad",1],["cotton","mouth",0],["mouth","organ",1],
  ["magic","trick",1],["magic","wand",1],["magic","carpet",1],["black","magic",1],["magic","bean",1],["magic","spell",1],["magic","mirror",1],["street","magic",1],
  ["trick","question",1],["trick","shot",1],["trick","knee",1],["dirty","trick",1],["trick","treat",-62],["party","trick",-2],["mind","trick",1],["one-trick","pony",-1],
  ["question","time",-63],["pop","question",-64],["essay","question",1],["million-dollar","question",-1],["burning","question",1],["loaded","question",1],
  ["wand","waving",-1],
  ["carpet","cleaner",1],["red","carpet",1],["carpet","ride",-65],
  ["mirror","image",1],["rear-view","mirror",-1],["mirror","ball",1],["smoke","mirror",-66],["funhouse","mirror",1],["mirror","maze",1],
  ["image","problem",-1],["spitting","image",1],["public","image",1],
  ["spell","book",1],["spell","bound",0],["dry","spell",1],["spell","caster",1],["sleeping","spell",1],["cold","spell",1],
  ["smoke","signal",1],["smoke","screen",0],["smoke","detector",1],["smoke","stack",0],["second-hand","smoke",-1],["smoke","ring",1],["chimney","smoke",1],
  ["signal","fire",1],["turn","signal",1],["signal","tower",1],["radio","signal",1],
  ["screen","door",1],["screen","time",1],["movie","screen",1],["screen","saver",0],["screen","test",1],["silver","screen",1],["touch","screen",1],["smoke","screen",-2],["window","screen",1],["green","screen",1],
  ["door","stop",-2],["revolving","door",1],["door","prize",1],["cellar","door",1],["barn","door",1],["saloon","door",1],["garage","door",1],["door","hinge",1],
  ["prize","fighter",1],["booby","prize",1],["door","prize",-2],["grand","prize",1],["consolation","prize",1],["prize","pig",1],
  ["fighter","pilot",1],["fire","fighter",0],["street","fighter",1],["freedom","fighter",1],["prize","fight",-2],["crime","fighter",1],
  ["pilot","light",1],["pilot","episode",1],["auto","pilot",0],["test","pilot",1],["bush","pilot",1],["pilot","program",1],
  ["light","switch",1],["light","bulb",1],["traffic","light",1],["lime","light",0],["candle","light",0],["spot","light",0],["gas","light",0],["sky","light",0],["porch","light",1],["light","pollution",1],["strobe","light",1],["light","saber",1],["lantern","light",1],["light","beam",1],
  ["switch","hitter",1],["bait","switch",-67],["light","switch",-2],["kill","switch",1],["switch","blade",0],
  ["bulb","planting",-1],["flash","bulb",1],
  ["traffic","jam",1],["traffic","cone",1],["traffic","cop",1],["rush-hour","traffic",-1],["foot","traffic",1],["traffic","circle",1],
  ["jam","session",1],["toe","jam",1],["paper","jam",1],["strawberry","jam",1],["log","jam",0],["jam","packed",-1],
  ["session","player",1],["study","session",1],["therapy","session",1],
  ["cone","head",0],["pine","cone",1],["snow","cone",1],["ice-cream","cone",-1],["cone","shell",-1],
  ["pine","needle",1],["pine","forest",1],["knotty","pine",1],
  ["needle","haystack",-68],["sewing","needle",1],["needle","thread",-69],["pins","needles",-1],
  ["thread","count",1],["needle","eye",-70],["common","thread",1],["thread","bare",0],["spool","thread",-71],
  ["count","down",-1],["head","count",-2],["body","count",1],["count","blessing",-72],["pollen","count",1],["calorie","count",1],
  ["forest","fire",1],["forest","ranger",1],["forest","floor",1],["petrified","forest",1],["enchanted","forest",1],
  ["ranger","station",1],["park","ranger",1],["lone","ranger",1],
  ["park","bench",1],["parking","lot",1],["amusement","park",1],["theme","park",1],["trailer","park",1],["park","avenue",-1],["dog","park",1],["skate","park",1],["national","park",1],["parking","meter",1],
  ["bench","press",1],["bench","warmer",1],["piano","bench",-2],["park","bench",-2],["work","bench",-2],["bench","mark",0],
  ["press","conference",1],["printing","press",1],["press","release",1],["bench","press",-2],["press","box",1],["french","press",1],["full-court","press",-1],
  ["conference","call",1],["conference","room",1],["press","pass",1],
  ["release","valve",1],["release","date",1],["catch","release",-73],
  ["valve","heart",-74],["pressure","valve",1],
  ["pressure","cooker",1],["peer","pressure",1],["blood","pressure",1],["pressure","point",1],["air","pressure",1],["pressure","wash",-1],
  ["cooker","slow",-75],["rice","cooker",1],
  ["rice","paddy",1],["fried","rice",1],["rice","paper",1],["wild","rice",1],
  ["paddy","wagon",1],
  ["blood","hound",0],["blood","moon",1],["blue","blood",1],["blood","orange",1],["blood","brother",1],["cold","blood",-76],["blood","type",1],
  ["hound","dog",1],["fox","hound",0],["grey","hound",0],
  ["fox","trot",0],["fox","hole",0],["fire","fox",-1],["fox","hunt",1],["sly","fox",1],["arctic","fox",1],
  ["trot","globe",-77],["turkey","trot",1],
  ["turkey","dinner",1],["cold","turkey",1],["turkey","leg",1],["wild","turkey",1],["turkey","vulture",1],
  ["dinner","table",1],["dinner","guest",1],["rehearsal","dinner",1],["tv","dinner",-1],["dinner","date",1],
  ["guest","room",1],["guest","list",-2],["guest","house",0],["party","guest",1],["guest","star",1],
  ["date","night",1],["blind","date",1],["date","palm",1],["expiration","date",1],["first","date",1],["due","date",1],["play","date",-2],
  ["night","owl",-2],["silent","night",1],["opening","night",1],["night","vision",1],["prom","night",1],
  ["vision","board",1],["tunnel","vision",1],["double","vision",1],["x-ray","vision",-1],
  ["tunnel","wind",-78],["train","tunnel",1],["carpal","tunnel",1],["tunnel","light",-79],
  ["owl","barn",-80],["barn","owl",1],["wise","owl",1],
  ["barn","yard",0],["barn","raising",1],["hay","barn",1],
  ["hay","stack",0],["hay","ride",1],["hay","fever",1],["hay","bale",1],["hit","hay",-81],
  ["stack","pancake",-82],["smoke","stack",-2],["stack","deck",-83],["book","stack",1],
  ["fever","dream",1],["cabin","fever",1],["fever","pitch",1],["gold","fever",1],["spring","fever",1],["saturday-night","fever",-1],
  ["dream","journal",1],["american","dream",-1],["day","dream",-2],["sweet","dream",1],["dream","big",-1],["lucid","dream",1],
  ["journal","entry",1],["dream","diary",1],["trade","journal",1],
  ["entry","fee",1],["grand","entry",1],["entry","level",1],
  ["fee","late",-84],["parking","fee",1],["entrance","fee",1],
  ["cabin","crew",1],["log","cabin",1],["cabin","pressure",1],["beach","cabin",-1],
  ["crew","neck",1],["film","crew",1],["road","crew",1],["crew","cut",-2],["rowing","crew",1],
  ["film","festival",1],["film","noir",1],["horror","film",1],["film","reel",1],["silent","film",1],["film","buff",1],
  ["festival","music",-85],["harvest","festival",1],["street","festival",1],["folk","festival",1],
  ["harvest","time",1],["wheat","harvest",1],["harvest","season",1],["bumper","crop",-1],
  ["wheat","field",1],["wheat","penny",1],["whole","wheat",1],
  ["field","day",1],["field","goal",-2],["corn","field",-2],["mine","field",0],["out","field",0],["field","guide",1],["battle","field",0],["left","field",1],["field","test",1],["strawberry","field",1],
  ["goal","line",-2],["dream","goal",-1],["stretch","goal",1],
  ["guide","dog",1],["tour","guide",1],["guide","book",0],["spirit","guide",1],["girl","guide",1],
  ["dog","paddle",1],["puppy","dog",1],["top","dog",1],["dog","whistle",1],["sheep","dog",0],["bird","dog",-2],["lap","dog",1],["under","dog",0],["dog","bone",1],["dog","collar",1],
  ["paddle","boat",1],["paddle","board",0],["canoe","paddle",1],["ping-pong","paddle",-1],
  ["canoe","trip",1],["canoe","race",-1],
  ["whistle","blower",0],["train","whistle",-2],["wolf","whistle",1],["whistle","stop",1],["tin","whistle",1],
  ["wolf","pack",1],["lone","wolf",1],["wolf","cry",-86],["big-bad","wolf",-1],["sea","wolf",-1],["were","wolf",0],
  ["pack","rat",1],["back","pack",-2],["six","pack",1],["ice","pack",1],["pack","mule",1],["fanny","pack",1],["battery","pack",1],["card","pack",-1],
  ["rat","race",1],["rat","trap",1],["gym","rat",1],["rat","tail",1],["lab","rat",1],["mall","rat",1],
  ["race","car",1],["horse","race",1],["relay","race",1],["race","day",1],["arms","race",1],["foot","race",1],["sack","race",1],["three-legged","race",-1],["rat","race",-2],["race","finish",-1],
  ["car","alarm",1],["car","key",1],["cable","car",1],["sports","car",1],["car","radio",1],["bumper","car",1],["getaway","car",1],["car","trouble",1],["clown","car",1],
  ["alarm","bell",1],["fire","alarm",-2],["false","alarm",1],["alarm","system",1],
  ["gym","class",1],["gym","teacher",1],["jungle","gym",1],["gym","membership",1],["gym","shorts",1],
  ["jungle","cat",1],["concrete","jungle",1],["jungle","cruise",1],
  ["cat","nap",0],["cat","nip",0],["copy","cat",0],["alley","cat",1],["cat","walk",0],["scaredy","cat",1],["cat","burglar",1],["house","cat",1],["cat","fight",1],["cool","cat",1],["cat","tongue",-88],["fat","cat",1],
  ["nap","kin",0],["cat","nap",-2],["power","nap",-2],
  ["copy","machine",1],["carbon","copy",1],["copy","editor",1],["copy","paste",-89],
  ["alley","way",0],["bowling","alley",1],["back","alley",1],["alley","oop",-1],
  ["walk","fame",-90],["jay","walk",0],["moon","walk",-2],["walk","shame",-91],["space","walk",1],["victory","walk",-1],["nature","walk",1],["random","walk",1],
  ["editor","chief",-92],["photo","editor",1],["video","editor",1],
  ["chief","staff",-93],["fire","chief",1],["police","chief",1],
  ["staff","meeting",1],["kitchen","staff",1],["staff","room",1],
  ["meeting","minutes",-1],["town","meeting",1],["board","meeting",1],["meeting","point",1],
  ["police","car",1],["police","report",1],["fashion","police",1],["police","sketch",1],
  ["report","weather",-94],["book","report",1],["news","report",1],["traffic","report",1],
  ["weather","vane",1],["weather","balloon",1],["weather","map",1],["weather","forecast",1],["stormy","weather",1],["weather","man",0],
  ["vane","wind",-95],
  ["balloon","animal",1],["hot-air","balloon",-1],["balloon","payment",1],["birthday","balloon",1],
  ["animal","kingdom",1],["party","animal",-2],["stuffed","animal",1],["animal","shelter",1],["animal","crackers",-1],["spirit","animal",1],
  ["kingdom","come",-1],["magic","kingdom",-1],["animal","instinct",1],
  ["shelter","dog",1],["bus","shelter",1],["tax","shelter",1],["bomb","shelter",1],
  ["bomb","squad",1],["photo","bomb",-2],["bath","bomb",1],["cherry","bomb",1],["stink","bomb",1],["smoke","bomb",1],["glitter","bomb",1],
  ["squad","car",1],["squad","goal",-96],["cheer","squad",1],
  ["cherry","tree",1],["cherry","blossom",1],["cherry","picker",1],["wild","cherry",1],["cherry","tomato",1],
  ["blossom","spring",-97],["orange","blossom",1],["apple","blossom",1],
  ["tomato","sauce",1],["tomato","soup",1],["tomato","plant",1],["tomato","paste",1],
  ["sauce","pan",1],["soy","sauce",1],["secret","sauce",1],["pasta","sauce",1],
  ["pan","handle",0],["frying","pan",1],["dust","pan",0],["dish","pan",0],["pan","flute",1],["peter","pan",-1],["pots","pans",-1],
  ["handle","door",-98],["door","handle",1],["love","handle",1],
  ["flute","player",1],["champagne","flute",1],
  ["dust","bunny",1],["gold","dust",1],["fairy","dust",1],["dust","storm",-2],["saw","dust",0],["dust","jacket",1],["cosmic","dust",1],
  ["bunny","hop",1],["bunny","slope",1],["dust","devil",1],["snow","bunny",1],["bunny","ears",-1],
  ["hop","scotch",0],["hip","hop",1],["sock","hop",1],["bar","hop",-1],["island","hop",-1],
  ["scotch","tape",1],["butter","scotch",-2],
  ["tape","measure",1],["duct","tape",1],["tape","recorder",1],["red","tape",1],["mix","tape",0],["masking","tape",1],["tape","deck",1],
  ["measure","cup",-99],["measuring","spoon",1],["tape","measure",-2],
  ["deck","card",-100],["deck","chair",-2],["ship","deck",1],["tape","deck",-2],["deck","hand",1],["observation","deck",1],
  ["ship","wreck",0],["ship","shape",0],["rocket","ship",1],["friend","ship",0],["relation","ship",0],["ghost","ship",1],["ship","captain",1],["cruise","ship",1],["mother","ship",0],["pirate","ship",1],["flag","ship",0],
  ["wreck","train",-101],["nervous","wreck",1],["wrecking","crew",1],
  ["rocket","science",1],["rocket","launch",1],["bottle","rocket",1],["rocket","fuel",1],["pocket","rocket",1],["model","rocket",1],
  ["science","fair",1],["science","fiction",1],["science","lab",1],["mad","science",-1],["computer","science",1],["science","project",1],
  ["fair","game",1],["county","fair",1],["fair","weather",1],["fun","fair",-2],["state","fair",1],["fair","share",1],["job","fair",1],["craft","fair",1],
  ["fiction","fact",-102],["pulp","fiction",-1],["fan","fiction",1],
  ["lab","coat",1],["lab","partner",1],["computer","lab",1],["lab","experiment",1],
  ["coat","hanger",1],["coat","rack",1],["trench","coat",1],["winter","coat",1],["coat","arm",-103],["fur","coat",1],["top","coat",0],["turn","coat",0],
  ["hanger","cliff",-104],["cliff","hanger",0],
  ["cliff","edge",1],["cliff","diving",1],["cliff","face",1],
  ["edge","knife",-105],["cutting","edge",1],["razor","edge",-106],["water","edge",-107],["ledge","window",-108],
  ["razor","blade",1],["razor","sharp",1],["razor","thin",1],["straight","razor",1],
  ["blade","grass",-109],["roller","blade",1],["shoulder","blade",1],["saw","blade",1],["switch","blade",-2],["fan","blade",1],
  ["grass","hopper",0],["grass","stain",1],["crab","grass",0],["lemon","grass",0],["snake","grass",-1],["blue","grass",0],["sea","grass",0],
  ["hopper","bell",-1],
  ["stain","glass",-110],["ink","stain",1],["coffee","stain",1],["blood","stain",1],
  ["glass","slipper",1],["hour","glass",0],["magnifying","glass",1],["glass","ceiling",1],["stained","glass",1],["looking","glass",1],["shot","glass",1],["glass","blower",1],["sea","glass",1],["spy","glass",0],
  ["slipper","bath",-1],["house","slipper",1],
  ["hour","hand",1],["rush","hour",1],["happy","hour",1],["eleventh","hour",1],["witching","hour",1],["golden","hour",1],["zero","hour",1],
  ["hand","shake",0],["hand","bag",0],["hand","book",-2],["hand","cuff",0],["back","hand",0],["second","hand",0],["hand","stand",0],["hand","print",0],["hand","rail",0],["upper","hand",1],["helping","hand",1],["hand","signal",1],["hired","hand",1],["hand","towel",1],["hand","warmer",1],["hand","crank",1],
  ["shake","down",-1],["hand","shake",-2],["milk","shake",-2],["salt","shake",-2],
  ["cuff","link",0],["rotator","cuff",1],
  ["link","chain",-111],["missing","link",1],["cuff","link",-2],["weak","link",1],
  ["rail","road",0],["rail","way",0],["hand","rail",-2],["third","rail",1],["rail","yard",1],["mono","rail",0],
  ["stand","off",-1],["night","stand",-2],["band","stand",-2],["grand","stand",0],["news","stand",-2],["hot-dog","stand",-1],["kick","stand",-2],["lemonade","stand",1],["last","stand",1],["taxi","stand",1],["umbrella","stand",1],["witness","stand",1],["music","stand",1],
  ["print","fine",-112],["finger","print",0],["foot","print",-2],["blue","print",0],["print","run",1],["paw","print",1],["screen","print",1],
  ["finger","tip",0],["finger","nail",0],["trigger","finger",1],["green","thumb",-1],["butter","finger",-1],["finger","food",1],["ring","finger",-2],["finger","puppet",1],["light","finger",-1],
  ["tip","iceberg",-113],["tip","jar",1],["tip","toe",0],["pro","tip",1],["hot","tip",1],["felt","tip",1],
  ["nail","polish",1],["nail","file",1],["rusty","nail",1],["tooth","nail",-114],["thumb","nail",0],["nail","salon",1],["nail","biter",1],
  ["polish","shoe",-115],["shoe","polish",1],["polish","silver",-1],
  ["file","cabinet",1],["single","file",1],["nail","file",-2],["case","file",-2],["file","folder",1],
  ["cabinet","kitchen",-116],["kitchen","cabinet",1],["medicine","cabinet",1],["curio","cabinet",1],
  ["medicine","ball",1],["medicine","man",1],["cough","medicine",1],
  ["cough","drop",1],["cough","syrup",1],["whooping","cough",1],
  ["syrup","maple",-117],["maple","syrup",1],["corn","syrup",1],
  ["maple","leaf",1],["maple","tree",1],["sugar","maple",1],
  ["leaf","blower",1],["four-leaf","clover",-1],["tea","leaf",1],["fig","leaf",1],["gold","leaf",1],["leaf","pile",1],["autumn","leaf",1],["clover","leaf",0],
  ["clover","field",1],["lucky","clover",1],
  ["blower","snow",-118],["snow","blower",1],
  ["pile","up",-1],["wood","pile",0],["compost","pile",1],["scrap","pile",1],
  ["compost","bin",1],["compost","heap",1],
  ["bin","recycling",-119],["recycling","bin",1],["trash","bin",1],["bread","bin",1],
  ["heap","scrap",-120],["trash","heap",1],
  ["trash","can",1],["trash","panda",1],["white","trash",1],["trash","compactor",1],
  ["can","opener",1],["watering","can",1],["tin","can",1],["can","do",-1],["soda","can",1],["spray","can",1],
  ["panda","bear",1],["panda","express",-1],["giant","panda",1],
  ["bear","hug",1],["teddy","bear",1],["polar","bear",1],["bear","market",1],["mama","bear",1],["bear","claw",1],["grizzly","bear",1],["bear","cave",1],
  ["hug","group",-121],["group","hug",1],
  ["group","chat",1],["group","project",1],["study","group",1],["group","photo",1],["support","group",1],["age","group",1],
  ["chat","room",1],["chit","chat",1],["fireside","chat",1],
  ["project","manager",1],["passion","project",1],["group","project",-2],["pet","project",1],["school","project",1],["side","project",1],
  ["manager","stage",-122],["stage","manager",1],["general","manager",1],["bank","manager",1],
  ["pet","store",1],["pet","peeve",1],["teacher","pet",-123],["pet","name",1],["pet","sitter",1],
  ["store","front",0],["general","store",1],["grocery","store",1],["store","credit",1],["candy","store",1],["department","store",1],["thrift","store",1],["hardware","store",1],
  ["front","porch",1],["front","door",1],["cold","front",1],["front","page",1],["battle","front",0],["ocean","front",0],["front","desk",1],["water","front",0],
  ["porch","swing",1],["porch","light",-2],["front","porch",-2],["back","porch",1],
  ["swing","set",1],["mood","swing",1],["swing","dance",1],["swing","vote",1],["porch","swing",-2],["swing","state",1],
  ["set","design",1],["sunset","set",-1],["chess","set",1],["stage","set",1],["box","set",1],["train","set",1],["tea","set",1],["drum","set",1],["jet","set",1],["twin","set",1],
  ["design","flaw",1],["interior","design",1],["graphic","design",1],["dress","design",-1],["design","studio",1],
  ["chess","board",1],["chess","piece",1],["chess","club",1],["chess","master",0],["speed","chess",1],
  ["page","turner",1],["front","page",-2],["home","page",1],["page","boy",1],["blank","page",1],["sports","page",1],
  ["turner","table",-124],["table","turner",-1],
  ["boy","band",1],["cow","boy",0],["paper","boy",-2],["boy","scout",1],["home","boy",0],["whipping","boy",1],["mama","boy",-125],["birthday","boy",1],
  ["band","practice",1],["one-man","band",-2],["rubber","band",-2],["big","band",1],["garage","band",1],["wedding","band",1],
  ["practice","target",-126],["target","practice",1],["practice","test",1],["choir","practice",1],
  ["target","audience",1],["moving","target",1],["easy","target",1],["off","target",-1],
  ["audience","member",1],["captive","audience",1],["studio","audience",-2],["live","audience",1],
  ["member","club",-127],["club","member",1],["family","member",1],["band","member",1],["crew","member",1],["cast","member",1],
  ["family","reunion",1],["family","recipe",1],["royal","family",1],["family","business",1],["family","feud",1],["extended","family",1],["family","dinner",1],["crime","family",1],
  ["reunion","class",-128],["class","reunion",1],["family","reunion",-2],["high-school","reunion",-1],
  ["recipe","book",1],["secret","recipe",1],["recipe","disaster",-129],["family","recipe",-2],
  ["disaster","zone",1],["natural","disaster",1],["disaster","relief",1],["disaster","movie",1],
  ["relief","pitcher",1],["comic","relief",1],["relief","map",1],["sigh","relief",-130],
  ["pitcher","plant",1],["water","pitcher",1],["relief","pitcher",-2],["pitcher","mound",-2],
  ["plant","food",1],["power","plant",-2],["spider","plant",1],["plant","kingdom",1],["potted","plant",1],["rubber","plant",1],["plant","nursery",1],
  ["spider","web",1],["spider","man",-1],["spider","silk",1],["spider","sense",1],["daddy-longlegs","spider",-1],["spider","vein",1],
  ["web","site",0],["web","browser",1],["food","web",1],["charlotte","web",-1],["web","designer",1],["world-wide","web",-1],["duck","web",-1],
  ["site","camp",-131],["construction","site",1],["camp","site",-2],["crash","site",1],["dig","site",1],["launch","site",1],
  ["browser","history",1],["web","browser",-2],
  ["history","book",1],["ancient","history",1],["history","buff",1],["history","lesson",1],["natural","history",1],["family","history",1],
  ["lesson","plan",1],["life","lesson",1],["piano","lesson",1],["object","lesson",1],["swimming","lesson",1],["history","lesson",-2],["driving","lesson",1],
  ["plan","master",-132],["game","plan",-2],["flight","plan",1],["master","plan",-2],["escape","plan",1],["floor","plan",-2],["backup","plan",1],["lesson","plan",-2],["payment","plan",1],["seating","plan",1],
  ["flight","attendant",1],["flight","deck",1],["night","flight",1],["flight","risk",1],["test","flight",1],["flight","path",1],["space","flight",1],["fancy","flight",-133],["flight","school",1],
  ["attendant","room",-134],
  ["risk","factor",1],["risk","taker",1],["high","risk",1],["calculated","risk",1],
  ["factor","fear",-135],["fear","factor",1],["wow","factor",1],["x","factor",-1],["sunscreen","factor",-1],
  ["fear","monger",0],["stage","fear",-136],["fear","dark",-137],["fear","height",-138],
  ["path","garden",-139],["garden","path",1],["war","path",-2],["bike","path",1],["flight","path",-2],["career","path",1],["path","least",-140],["beaten","path",1],
  ["bike","lane",1],["mountain","bike",1],["bike","ride",1],["dirt","bike",1],["exercise","bike",1],["bike","helmet",1],["tandem","bike",1],
  ["lane","memory",-141],["memory","lane",1],["fast","lane",1],["passing","lane",1],["lane","change",1],["bowling","lane",1],["swim","lane",-2],["love","lane",-1],["country","lane",1],
  ["memory","foam",1],["memory","card",1],["muscle","memory",1],["photographic","memory",1],["memory","game",1],["core","memory",1],
  ["foam","sea",-142],["foam","finger",1],["shaving","foam",1],["sea","foam",1],
  ["muscle","car",1],["muscle","shirt",1],["muscle","cramp",1],
  ["shirt","pocket",1],["t","shirt",-1],["dress","shirt",1],["hawaiian","shirt",1],["shirt","sleeve",1],["stuffed","shirt",1],
  ["cramp","leg",-143],["writer","cramp",-144],["leg","cramp",1],["stomach","cramp",1],
  ["sleeve","card",-145],["long","sleeve",1],["record","sleeve",1],["sleeve","tattoo",1],
  ["tattoo","parlor",1],["tattoo","artist",1],["temporary","tattoo",1],
  ["parlor","trick",1],["ice-cream","parlor",-1],["pizza","parlor",1],["beauty","parlor",1],["parlor","game",1],
  ["pizza","box",1],["pizza","oven",1],["pizza","slice",1],["pizza","delivery",1],["pizza","party",1],["pepperoni","pizza",1],["pizza","dough",1],["pizza","crust",1],["pizza","topping",1],
  ["oven","mitt",1],["toaster","oven",1],["dutch","oven",1],["brick","oven",1],["oven","timer",1],["microwave","oven",1],["oven","rack",1],["easy-bake","oven",-1],
  ["mitt","baseball",-146],["catcher","mitt",-147],["oven","mitt",-2],
  ["timer","egg",-148],["egg","timer",1],["kitchen","timer",1],["timer","sand",-149],
  ["delivery","room",1],["special","delivery",1],["delivery","truck",1],["mail","delivery",1],["delivery","driver",1],
  ["mail","carrier",1],["fan","mail",1],["chain","mail",1],["junk","mail",1],["snail","mail",1],["mail","order",1],["mail","room",0],["mail","slot",1],["black","mail",0],["mail","man",-2],
  ["carrier","aircraft",-150],["aircraft","carrier",1],["mail","carrier",-2],["letter","carrier",1],["carrier","pigeon",-2],
  ["aircraft","hangar",1],["model","aircraft",1],
  ["hangar","door",1],["airplane","hangar",1],
  ["airplane","mode",1],["paper","airplane",-2],["airplane","ticket",1],["model","airplane",1],["airplane","pilot",1],["toy","airplane",1],
  ["mode","transport",-151],["beast","mode",1],["sleep","mode",1],["vacation","mode",1],
  ["beast","burden",-152],["gentle","beast",-1],["beauty","beast",-153],["wild","beast",0],
  ["burden","proof",-154],["heavy","burden",1],
  ["proof","reading",-1],["fool","proof",0],["bullet","proof",0],["living","proof",1],["water","proof",-2],["fire","proof",0],["proof","concept",-155],["sound","proof",0],
  ["bullet","train",1],["silver","bullet",1],["bullet","point",-2],["dodge","bullet",-156],["bite","bullet",-157],
  ["dodge","ball",0],
  ["bite","size",1],["snake","bite",1],["frost","bite",0],["sound","bite",1],["mosquito","bite",1],["love","bite",1],["bug","bite",1],
  ["size","matter",-158],["pocket","size",1],["fun","size",-2],["king","size",1],["life","size",1],["bite","size",-2],["plus","size",1],["actual","size",1],
  ["king","cobra",1],["drama","king",-1],["king","crab",1],["king","bed",-159],["burger","king",-1],["king","castle",-160],["king","jungle",-161],
  ["cobra","pose",1],
  ["crab","cake",1],["crab","apple",0],["hermit","crab",1],["crab","leg",1],["crab","walk",1],["crab","grass",-2],["crab","pot",1],["fiddler","crab",1],
  ["pose","yoga",-162],["yoga","pose",1],["power","pose",1],["strike","pose",-163],
  ["yoga","mat",1],["yoga","class",1],["yoga","pants",-1],["hot","yoga",1],["yoga","studio",1],["yoga","instructor",1],
  ["mat","welcome",-164],["welcome","mat",1],["door","mat",-2],["gym","mat",1],["place","mat",0],["mouse","mat",-1],["bath","mat",1],["mat","exercise",-165],
  ["welcome","home",-1],["welcome","party",1],["warm","welcome",1],["welcome","sign",1],["hero","welcome",-166],
  ["warm","front",1],["warm","fuzzy",-1],["luke","warm",0],["global","warming",-1],["warm","up",-1],["warm","glow",1],
  ["glow","stick",1],["glow","worm",-2],["after","glow",0],["moon","glow",0],["glow","dark",-167],["warm","glow",-2],["candle","glow",1],["firefly","glow",-1],
];

// ---- decode display units ----
// style 0 = "ab" closed; 1 = "a b"; negative = irregular idioms indexed below;
// -1 marks pairs to SKIP (authoring rejects kept for the record).
const IRREGULAR = {
  "-2": null, // duplicate marker: skip (pair exists elsewhere)
  "-3": "pot of gold", "-4": "tug of war", "-5": "fairy tale", "-6": "treasure hunt",
  "-7": "paper kite", "-8": "track and field", "-9": "suit and tie", "-10": "school of fish",
  "-11": "phone booth", "-12": "manhole", "-13": "bumblebee", "-14": "bump in the road",
  "-15": "crime scene", "-16": "partner in crime", "-17": "stroke of luck", "-18": "lucky charm",
  "-19": "beginner's luck", "-20": "luck of the draw", "-21": "bull in a china shop",
  "-22": "person of interest", "-23": "fill in the blank", "-24": "nightcap", "-25": "rack of lamb",
  "-26": "lamb's wool", "-27": "rap sheet", "-28": null, "-29": "run of the mill",
  "-30": "stone cold", "-31": "fright night", "-32": "good news", "-33": "trip and fall",
  "-34": "neighbor's fence", "-35": "heartstrings", "-36": "mac and cheese", "-37": "artist's studio",
  "-38": "chip off the old block", "-39": "writer's block", "-40": "hall of fame",
  "-41": "fame and fortune", "-42": "claim to fame", "-43": "soldier of fortune", "-44": "cookie crumb",
  "-45": "driver's seat", "-46": null, "-47": "shed light", "-48": null,
  "-49": "lawn gnome", "-50": "mower blade", "-51": "fork in the road", "-52": "knife and fork",
  "-53": "pitch dark", "-54": "frame of mind", "-55": "mind over matter", "-56": "peace of mind",
  "-57": "matter of fact", "-58": null, "-59": "fair and square", "-60": "grass roots",
  "-61": "word of mouth", "-62": "trick or treat", "-63": "question time", "-64": "pop the question",
  "-65": "magic carpet ride", "-66": "smoke and mirrors", "-67": "bait and switch",
  "-68": "needle in a haystack", "-69": "needle and thread", "-70": "eye of the needle",
  "-71": "spool of thread", "-72": "count your blessings", "-73": "catch and release",
  "-74": "heart valve", "-75": "slow cooker", "-76": "in cold blood", "-77": "globe trotter",
  "-78": "wind tunnel", "-79": "light at the end of the tunnel", "-80": "barn owl",
  "-81": "hit the hay", "-82": "pancake stack", "-83": "stack the deck", "-84": "late fee",
  "-85": "music festival", "-86": "cry wolf", "-87": "robin's egg", "-88": "cat got your tongue",
  "-89": "copy and paste", "-90": "walk of fame", "-91": "walk of shame", "-92": "editor in chief",
  "-93": "chief of staff", "-94": "weather report", "-95": "weather vane", "-96": "squad goals",
  "-97": null, "-98": "door handle", "-99": "measuring cup", "-100": "deck of cards",
  "-101": "train wreck", "-102": "fact and fiction", "-103": "coat of arms", "-104": "cliffhanger",
  "-105": "knife's edge", "-106": "razor's edge", "-107": "water's edge", "-108": "window ledge",
  "-109": "blade of grass", "-110": "stained glass", "-111": "chain link", "-112": "fine print",
  "-113": "tip of the iceberg", "-114": "tooth and nail", "-115": "shoe polish", "-116": "kitchen cabinet",
  "-117": "maple syrup", "-118": "snow blower", "-119": "recycling bin", "-120": "scrap heap",
  "-121": "group hug", "-122": "stage manager", "-123": "teacher's pet", "-124": "turntable",
  "-125": "mama's boy", "-126": "target practice", "-127": "club member", "-128": "class reunion",
  "-129": "recipe for disaster", "-130": "sigh of relief", "-131": "campsite", "-132": "master plan",
  "-133": "flight of fancy", "-134": "attendant", "-135": "fear factor", "-136": "stage fright",
  "-137": "fear of the dark", "-138": "fear of heights", "-139": "garden path", "-140": "path of least resistance",
  "-141": "memory lane", "-142": "sea foam", "-143": "leg cramp", "-144": "writer's cramp",
  "-145": "card up your sleeve", "-146": "baseball mitt", "-147": "catcher's mitt", "-148": "egg timer",
  "-149": "sand timer", "-150": "aircraft carrier", "-151": "mode of transport", "-152": "beast of burden",
  "-153": "beauty and the beast", "-154": "burden of proof", "-155": "proof of concept",
  "-156": "dodge a bullet", "-157": "bite the bullet", "-158": "size matters", "-159": "king-size bed",
  "-160": "king of the castle", "-161": "king of the jungle", "-162": "yoga pose", "-163": "strike a pose",
  "-164": "welcome mat", "-165": "exercise mat", "-166": "hero's welcome", "-167": "glow in the dark",
};

const WORD_RE = /^[a-z]+$/;

function decodePairs() {
  const edges = [];
  const seen = new Set();
  for (const [a, b, style] of PAIRS) {
    if (!WORD_RE.test(a) || !WORD_RE.test(b)) continue; // hyphenated/multiword author notes: skip
    let unit;
    if (style === 0) unit = a + b;
    else if (style === 1) unit = a + " " + b;
    else {
      const irr = IRREGULAR[String(style)];
      if (irr === null || irr === undefined) continue; // -1 rejects, -2 duplicates
      unit = irr;
    }
    // structural rule: the unit must contain both words
    const flat = unit.toLowerCase().replace(/[^a-z]/g, " ");
    if (!(flat.includes(a) && flat.includes(b))) continue;
    const key = a < b ? a + "|" + b : b + "|" + a;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ a, b, unit });
  }
  return edges;
}

// ---- longest-cycle search: greedy DFS + Pósa rotations, random restarts ----
function findCycle(edges, timeMs = 120000, seedStart = 7) {
  const adj = new Map(); // word -> Set of neighbor words
  for (const e of edges) {
    if (!adj.has(e.a)) adj.set(e.a, new Set());
    if (!adj.has(e.b)) adj.set(e.b, new Set());
    adj.get(e.a).add(e.b);
    adj.get(e.b).add(e.a);
  }
  // 2-core prune: words with <2 links can never sit inside a cycle
  for (;;) {
    const drop = [...adj.keys()].filter((w) => adj.get(w).size < 2);
    if (drop.length === 0) break;
    for (const w of drop) {
      for (const n of adj.get(w)) adj.get(n)?.delete(w);
      adj.delete(w);
    }
  }
  const words = [...adj.keys()];
  console.log(`2-core: ${words.length} words, ${[...adj.values()].reduce((s, x) => s + x.size, 0) / 2} edges`);
  let best = null; // array of words forming a cycle (last connects to first)
  let seed = seedStart;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0; // deterministic: reproducible builds
    return seed / 4294967296;
  };
  const deadline = Date.now() + timeMs;

  while (Date.now() < deadline) {
    // random hub-ish start
    const start = words[Math.floor(rand() * words.length)];
    let path = [start];
    const pos = new Map([[start, 0]]);

    const extend = () => {
      for (;;) {
        const tail = path[path.length - 1];
        const opts = [...adj.get(tail)].filter((w) => !pos.has(w));
        if (opts.length === 0) return;
        // prefer neighbors with fewer remaining options (save hubs), with noise
        let pick = opts[0];
        let bestScore = Infinity;
        for (const w of opts) {
          let d = 0;
          for (const n of adj.get(w)) if (!pos.has(n)) d++;
          const score = d + rand() * 2;
          if (score < bestScore) { bestScore = score; pick = w; }
        }
        pos.set(pick, path.length);
        path.push(pick);
      }
    };

    extend();
    // Pósa rotations: when stuck, pivot the tail to open new extension frontiers
    let rotations = 0;
    const maxRot = 4000;
    while (rotations < maxRot && Date.now() < deadline) {
      const tail = path[path.length - 1];
      // record cycle if closable and best so far
      if (adj.get(tail).has(path[0]) && path.length > 2) {
        if (!best || path.length > best.length) best = [...path];
        if (path.length === words.length) return best; // can't do better
      }
      // rotate: pick a random neighbor of tail inside the path, reverse the suffix
      const inPath = [...adj.get(tail)].filter((w) => {
        const i = pos.get(w);
        return i !== undefined && i < path.length - 2;
      });
      if (inPath.length === 0) break;
      const u = inPath[Math.floor(rand() * inPath.length)];
      const i = pos.get(u);
      // reverse path[i+1 .. end]
      const suffix = path.splice(i + 1).reverse();
      path = path.concat(suffix);
      for (let k = i + 1; k < path.length; k++) pos.set(path[k], k);
      rotations++;
      extend();
    }
    // final closure check for this restart
    const tail = path[path.length - 1];
    if (adj.get(tail).has(path[0]) && path.length > 2) {
      if (!best || path.length > best.length) best = [...path];
    }
  }
  return best;
}

// ---- main ----
const edges = decodePairs();
console.log(`decoded ${edges.length} valid pairs over ${new Set(edges.flatMap((e) => [e.a, e.b])).size} words`);
const writePairs = () => {
  const pairList = edges.map((e) => [e.a, e.b]).sort((x, y) => (x[0] + x[1] < y[0] + y[1] ? -1 : 1));
  writeFileSync(new URL("../data/pairs.json", import.meta.url), JSON.stringify(pairList) + "\n");
  console.log(`wrote data/pairs.json: ${pairList.length} joinable pairs`);
};
if (process.argv.includes("--pairs-only")) {
  // refresh pairs.json without re-solving (a new solve changes the chain,
  // which would require a full heat rebake)
  writePairs();
  process.exit(0);
}
const unitOf = new Map();
for (const e of edges) {
  unitOf.set(e.a + "|" + e.b, e.unit);
  unitOf.set(e.b + "|" + e.a, e.unit);
}
let cycle = findCycle(edges);
if (!cycle) {
  console.error("no cycle found");
  process.exit(1);
}
console.log(`best cycle: ${cycle.length} words`);

// cap at 366 days (a year) — trim by removing the lowest-value stretch if longer
if (cycle.length > 366) {
  // trim: find a chord that shortcuts the cycle to as close to 366 as possible
  const target = 366;
  const posIn = new Map(cycle.map((w, i) => [w, i]));
  const adjSet = new Map();
  for (const e of edges) {
    if (!adjSet.has(e.a)) adjSet.set(e.a, new Set());
    if (!adjSet.has(e.b)) adjSet.set(e.b, new Set());
    adjSet.get(e.a).add(e.b);
    adjSet.get(e.b).add(e.a);
  }
  let bestTrim = null; // {i, j} keep cycle[i..j] plus chord j->i
  for (let i = 0; i < cycle.length; i++) {
    for (const n of adjSet.get(cycle[i])) {
      const j = posIn.get(n);
      if (j === undefined) continue;
      const len = ((j - i + cycle.length) % cycle.length) + 1;
      if (len <= 366 && (!bestTrim || len > bestTrim.len)) bestTrim = { i, j, len };
    }
  }
  if (bestTrim && bestTrim.len > 300) {
    const { i, j } = bestTrim;
    cycle = j >= i ? cycle.slice(i, j + 1) : [...cycle.slice(i), ...cycle.slice(0, j + 1)];
    console.log(`trimmed to ${cycle.length} words via chord`);
  } else {
    cycle = cycle.slice(0, 366); // fallback: hard cut (breaks wrap; solver rarely needs this)
    console.log("hard-trimmed to 366 (wrap may be imperfect)");
  }
}

// rotate so "coffee" is day 0 if present
const ci = cycle.indexOf("coffee");
if (ci > 0) cycle = [...cycle.slice(ci), ...cycle.slice(0, ci)];

const out = {
  epoch: "2026-01-01",
  timezone: "America/Los_Angeles",
  words: cycle.map((w, i) => {
    const prev = cycle[(i - 1 + cycle.length) % cycle.length];
    const unit = unitOf.get(prev + "|" + w);
    if (!unit) throw new Error(`no unit for ${prev} -> ${w}`);
    return { w, pivot: unit };
  }),
};
writeFileSync(new URL("../data/chain.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
// the full pair list ships too: the game flags any guess that joins
// yesterday's word ("tin" on a "can" day) as near-yesterday, exactly.
writePairs();
console.log(`wrote data/chain.json: ${out.words.length} words, every link a lexical unit`);
console.log("first 15:", out.words.slice(0, 15).map((e) => `${e.w} (${e.pivot})`).join(" → "));
