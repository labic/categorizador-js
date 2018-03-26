var xlsReader = require('xlsx');
var csv = require('fast-csv');
var restify = require('restify');
var _ = require('underscore');
var S = require('string');
var sw = require('./searchWord');

var pages;
var tags;
var map;
var filtro;
var pageList = getPageList();

function getPageList(){
	pages = {};
	path = "produtos modelagem/facebook/";

	fileName = path + "facebook_pages.xlxs";
	var workbook = xlsReader.readFile(fileName);
	var sheet = workbook.Sheets[workbook.SheetNames[0]];
	pointer = 2;					
	while(!(sheet["A" + pointer] === undefined)){
		tempId = sheet["A" + pointer].v;		
		result = [];

		if(!(pages["#" + tempId] === undefined)){
			console.log(tempId + " " + sheet["B" + pointer].v );
		}
		
		//tema
		cell = sheet["D" + pointer];
		if(!(cell === undefined)){
			valuesTema = cell.v.split(",");
			for(tema in valuesTema){
				result.push("tema-" + valuesTema[tema]);
			}
		}	
		
		//territorio
		cell = sheet["E" + pointer];
		if(!(cell === undefined)){
			result.push("territorio-" + cell.v);
		}

		//ator
		cell = sheet["C" + pointer];
		if(!(cell === undefined)){
			atores = cell.v.split(",");
			for(ator in atores){				
				result.push("ator-" + atores[ator]);
			}
		}
		
		pages["#" + tempId] = result;
		pointer++			
	}			
	console.log(fileName + " acabou.");			
	getWordMap();	
}

function getWordMap(){
	map = [];	
	csv.fromPath("produtos modelagem/territorio/palavras_regiao.csv")
 	.on("data", function(data){ 	
 		d = data[0].toLowerCase(); 	
 		map[d] = data[1].toLowerCase();
 	})
 	.on("end", function(){
		getFilters(); 	
 	});
}

function getFilters(){
	filtro = [];
	path = "produtos modelagem/facebook/FILTROS FACEBOOK.xlsx"
	workbook = xlsReader.readFile(path);
	for(i=0;i<4;i++){		
		sheet = workbook.Sheets[workbook.SheetNames[i]];
		pointer = 2;
		while(sheet['A' + pointer] != null){
			key = sheet['A' + pointer].v;
			key = trataEntrada(key);
			filtro.push(key);
			pointer++;
		}		
	}
	console.log(path + " acabou.");
	getTags();
}

function getTags(){	
	tags = {lgbt: [], negros:[], indigena:[], genero:[]};
	path = "produtos modelagem/conteudo/TAGS FIXAS.xlsx";
	tags.lgbt = getSubtemas(path, "LGBT");	
	tags.negros = getSubtemas(path, "NEGROS");
	tags.indigena = getSubtemas(path,"INDÍGENAS");
	tags.genero = getSubtemas(path, "GÊNERO");			
	
	runServer();

	function getSubtemas(filename,aba){
		var sub = [];

		var workbook = xlsReader.readFile(filename);
		
		var sheet = workbook.Sheets[aba];
		var pointer = 2;
		while(sheet['B' + pointer] != null){
			key = sheet['A' + pointer].v;
			key = trataEntrada(key);
			value = sheet['B' + pointer].v;
			sub[key.toLowerCase()] = {conteudo: value.toLowerCase()};
			pointer++;
		}		
		return sub;
	}
}

function runServer(){
	var server = restify.createServer();
	server.use(restify.queryParser());
	server.get('/facebook/categorize/:coiso', respond);	

	server.listen(4021, function() {
  		console.log('%s listening at %s', server.name, server.url);
	});	

	function respond(req, res, next){
		var p = req.params;		
		if(p.text === undefined || p.page === undefined){
			res.send(new Error("mal formed url. Try .../facebook/categorize/?text=<text>&page=<pageId>"));
		}
		text = p.text.toLowerCase();
		if(!filter(filtro, text)){
			res.json({ok:false,categories:[]});
		}else{		
			pageId = "#" + p.page;		
			categories = [];

			pageData = pages[pageId];					

			if(!(pageData === undefined)){
				categories = _.union(categories,pageData);
			}else{
				console.log("page " + pageId + " não encontrada");
			}	

			for(tema in tags){
				temp = tags[tema];					
				for(tag in temp){					
					if(sw.searchWord(text,tag)){						
						categories = _.union(categories,["conteudo-" + temp[tag].conteudo]);
						categories = _.union(categories,["tema-" + tema]);
					}
				}
			}

			for(m in map){
				if(sw.searchWord(text,m)){				
					categories = _.union(categories,["territorio-"+map[m]]);
				}
			}
			console.log(categories);
			res.json({categories:categories,ok: true});		
		}
	}
}

function trataEntrada(key){
	if (key.indexOf("\"") == -1){
		return S(key).replaceAll(" ", " + ").s.toLowerCase();
	}else{
		splited = key.split("\"");
		r = (splited[0] == "") ? splited[1] : S(splited[0]).replaceAll(" ", " + ").s + splited[1];
		r = (splited[2] == "") ? r : r + S(splited[2]).replaceAll(" ", " + ").s;
		r = r.toLowerCase();
		return r;		
	}
}

function filter(filtro, texto){	
	for(i in filtro){		
		if(sw.searchWord(texto,filtro[i])){			
			return true;
		}
	}	
	return false;
}
