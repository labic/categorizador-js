var xlsReader = require('xlsx');
var csv = require("fast-csv");
var restify = require('restify');
var _ = require('underscore');
var S = require('string');
var sw = require('./searchWord');

var userList = getUserList();

function getUserList(){
	
	newUserList = [];

	pathPerfis = "produtos modelagem/perfis/twitter/";
	fileNames = [
				{file:"ATIVISTAS/Ativistas_gênero.xlsx", perfil:"ativista"},
				{file:"ATIVISTAS/Ativistas_indígenas.xlsx", perfil:"ativista"},
				{file:"ATIVISTAS/Ativistas_lgbt.xlsx", perfil:"ativista"},
				{file:"ATIVISTAS/Ativistas_negros.xlsx", perfil:"ativista"},
				{file:"CELEBRIDADES/ModelagemPerfis_Celebridades.xlsx", perfil:"celebridades", subcategoria:"getD"},
				{file:"MÍDIA/Midia_Independente_Perfis_FINAL.xlsx", perfil:"midia", subcategoria:"independente", territorio:"getC"},
				{file:"MÍDIA/Midia_Institucional_Perfis_FINAL.xlsx", perfil:"midia", subcategoria:"institucional", territorio:"getC"},
				{file:"MÍDIA/Midia_Tradicional_Perfis_FINAL.xlsx", perfil:"midia", subcategoria:"tradicional", territorio:"getC"},
				{file:"MOVIMENTOS SOCIAIS/Movimentos Sociais_gênero.xlsx", perfil:"movimentos-sociais"},
				{file:"MOVIMENTOS SOCIAIS/Movimentos Sociais_indígenas.xlsx", perfil:"movimentos-sociais"},
				{file:"MOVIMENTOS SOCIAIS/Movimentos Sociais_lgbt.xlsx", perfil:"movimentos-sociais"},
				{file:"MOVIMENTOS SOCIAIS/Movimentos Sociais_negros.xlsx", perfil:"movimentos-sociais"},		
				{file:"POLÍTICOS/ModelagemPerfis_PartidosPolíticos_Presidentes.xlsx", perfil:"politicos", subcategoria:"getC"},
				{file:"POLÍTICOS/ModelagemPerfis_Politicos.xlsx", perfil:"politicos", subcategoria:"getC", territorio:"getE"}
				];

	for(i=0;i<fileNames.length;i++){
		thisFileMetaData = fileNames[i];
		var workbook = xlsReader.readFile(pathPerfis + thisFileMetaData.file);
		var sheet = workbook.Sheets[workbook.SheetNames[0]];
		var pointer = 1;
		while(sheet['B' + pointer] != null){
			cell = sheet['B' + pointer].v;
			firstChar = cell.charAt(0);
			verify = firstChar == ' ' || firstChar == '@';
			cell = verify ? cell.slice(1,cell.length) : cell;
			
			thisUser = newUserList[cell] = [];
			
			//CATEGORIA
			thisUser[0] = "perfil-" + thisFileMetaData.perfil;
			
			//SUBCATEGORIA
			sub = thisFileMetaData.subcategoria;
			if(!(sub === undefined)){
				sub = defineTema(sheet,sub);
				if(sub != null){ thisUser[0] = thisUser[0] + "-" + sub; }				
			}

			//TERRITORIO
			territorio = thisFileMetaData.territorio;
			if(!(territorio === undefined)){
				territorio = defineTema(sheet,territorio);
				if(territorio != null){ thisUser.push("territorio-" + territorio); }
			}

			pointer++;
		}		
	}	

	return newUserList;
	
	function defineTema(sheet,input){
		if(input.slice(0,3) == "get"){	
			cell = sheet[input.charAt(3) + pointer];				
			return cell === undefined ? null : cell.v.toLowerCase();
		}else{
			return input;
		}
	}		
}

var tags;
var territorios = getWordMap();

function getWordMap(){
	map = [];	
	csv.fromPath("produtos modelagem/territorio/palavras_regiao.csv")
 	.on("data", function(data){ 	
 		d = data[0].toLowerCase(); 	
 		map[d] = data[1].toLowerCase();
 	})
 	.on("end", function(){
		getCities(); 	
 	});
}

function getCities(){
	cities = [];

	csv.fromPath("produtos modelagem/territorio/geocodes_NEW.csv")
	.on("data", function(data){
		d = data[0].toLowerCase();
		cities[d] = {};
		cities[d].estado = data[1].toLowerCase();
		cities[d].latitude = data[2]; 	
		cities[d].longitude = data[3];
		cities[d].placeID = data[4];
	})
	.on("end",function(){
		tags = getTags();
	});
}

function getTags(){	
	tags = {lgbt: [], negros:[], indigena:[], genero:[]};
	path = "produtos modelagem/conteudo/TAGS FIXAS.xlsx";
	tags.lgbt = getSubtemas(path, "LGBT");	
	tags.negros = getSubtemas(path, "NEGROS");
	tags.indigena = getSubtemas(path,"INDÍGENAS");
	tags.genero = getSubtemas(path, "GÊNERO");			
	mongoConnect(tags,cities);

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

		//contra
		/*pointer = 2;
		sheet = workbook.Sheets[workbook.SheetNames[1]];
		while(sheet['B' + pointer] != null){
			key = sheet['A' + pointer].v;
			key = trataEntrada(key);
			value = sheet['B' + pointer].v;
			sub[key] = {orientacao: "contra", conteudo: value.toLowerCase()};
			pointer++;
		}*/
		return sub;
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
}

function mongoConnect(tags, cities){

	function respond(req, res, next) {
		var p = req.params;
		if(p.text === undefined || p.user === undefined || p.theme === undefined || p.userLocation === undefined || p.place === undefined){
			res.send(new Error("mal formed url. Try .../tweets/categorize/?user=<username>&text=<text>&theme=<tema>&userLocation=<location>&place=<place_full_name>"));
		}
		text = p.text;
		console.log(p);
		
		categories = [];
		categories.push("tema-" + p.theme);
		temp = tags[p.theme];
		city_geo = null;
		
		if(temp === undefined){
			res.send(new Error(p.theme + "não mapeado"));
		}
		
		//conteudo
		for(i in temp){
		    if(sw.searchWord(text.toLowerCase(),i)){
		        categories = _.union(categories,["conteudo-" + temp[i].conteudo, "orientacao-" + temp[i].orientacao]);
		    }
		}

		//user
		if(!(userList[p.user] === undefined)){	         			
			categories = _.union(userList[p.user].slice(),categories);	         			
		}	

		//territorio
		for(i in map){
		    if(sw.searchWord(text.toLowerCase(),i)){
		        categories = _.union(categories,["territorio-" + map[i]]);	
		        //verifica cidade
		        palavraChave = i.split(" + ")[0]
		        cidade = cities[palavraChave];
		        if(!(cidade === undefined)){
		        	categories = _.union(categories,["cidade-" + palavraChave]);
		        	city_geo = [cidade.latitude,cidade.longitude];
		        }
		    }
		}

		//territorio por location e place usando cities
		for(i in cities){
		    if(p.userLocation != null){
		        if(sw.searchWord(p.userLocation.toLowerCase(),i)){		         				
		         	categories = _.union(categories,["territorio-" + cities[i].estado]);
		         	categories = _.union(categories,["cidade-" + i]);
		         	cidade = cities[i];
		         	city_geo = [cidade.latitude,cidade.longitude];		         						
		        }
		    }
		    if(p.place != null){
		    	if(sw.searchWord(p.place.toLowerCase(),i)){		         				
		    		categories = _.union(categories,["territorio-" + cities[i].estado]);
		         	categories = _.union(categories,["cidade-" + i]);
		         	cidade = cities[i];
		         	city_geo = [cidade.latitude,cidade.longitude];							
		        }
		    }
		}
				
  		res.json({city_geo: city_geo, categories:categories});
  		next();
	}


	var server = restify.createServer();
	server.use(restify.queryParser());
	server.get('/tweets/categorize/:coiso', respond);	

	server.listen(4020, function() {
  		console.log('%s listening at %s', server.name, server.url);
	});
}

