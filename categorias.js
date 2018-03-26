/*
versão 30/09/2015
Lendo pró e contra no get tags
criada a função trataEntrada para tratar a entrada.
classificação da orientação em pró e contra
*/

var _ = require('underscore');
var Db = require('mongodb').Db;
var Server = require('mongodb').Server;	
var xlsReader = require('xlsx');
var csv = require("fast-csv");
var settings = require("./settings");
var S = require("string");

var args = process.argv;

var updateMap = [];

var userList = getUserList();
var territorios = getWordMap();
var queryResultCount = 0;
var count = 0

var contador = 0

function insertOnMap(key, value){
	if(updateMap[key] === undefined){
		updateMap[key] = [];
		contador++;
	}
	updateMap[key].push(value);
}

function mongoConnect(map,cities,tags){

	var db = new Db('twixplorer',new Server(settings.mongoip,settings.mongoport)).db("twixplorer");	
	console.log(db)
	db.open(function(err,db){
		db.authenticate(settings.mongouser,settings.mongopsw,function(err,result){
			if(err){
				console.log(err);

			}else{
				console.log("conectado");		
				var collection = db.collection("tweets");

				query = {};
				if(args[2] == "-min"){
					atualTime = new Date().getTime();
					targetTime = atualTime - (parseInt(args[3]) * 60 * 1000);
					query = {
						"status.timestamp_ms":{$lt:atualTime, $gt:targetTime}
					}
				}
				if(args[2] == "uncategorized"){
					query = {categories:{$exists: false}}
				} 
				if(args[2] == "-q"){
					console.log(args[3]);
					query = new JSON(args[3]);
				}

				console.log(query);

				collection.count(query, function(err,count){
					if(err){console.log(err);}
					console.log(count);
					queryResultCount = count;
				});				

				collection.find(query,function(err,search){
				
					search.each(function(err,doc){
						if (doc != null) {
							text = doc.status.text;
							userLocation = doc.status.user.location;
							place = doc.status.place;

							place_full_name = (place == null) ? null : place["full_name"];												
							insertOnMap("tema-" + doc.theme,doc.status.id_str);									

							//subtema
							temp = tags[doc.theme];
							if(temp === undefined){console.log(doc.theme + "não mapeado");}
							for(i in temp){
		         				if(searchWord(text.toLowerCase(),i)){		         				
		         					insertOnMap("conteudo-" + temp[i].conteudo,doc.status.id_str);
		         					insertOnMap("orientacao-" + temp[i].orientacao,doc.status.id_str);								
		         				}
		         			}

		         			//user
		         			if(!(userList[doc.status.user.screen_name] === undefined)){	         			
		         				categories = userList[doc.status.user.screen_name];
		         				for(j=0;j<categories.length;j++){
		         					insertOnMap(categories[j],doc.status.id_str);
		         				}	         			
		         			}
	         			
		         			//territorio
		         			for(i in map){
		         				if(searchWord(text.toLowerCase(),i)){		         				
		         					insertOnMap("territorio-" + map[i],doc.status.id_str);
		         					//verifica cidade
		         					palavraChave = i.split(" + ")[0];
		         					cidade = cities[palavraChave];
		         					if(!(cidade === undefined)){
		         						//console.log(cidade);
		         						insertOnMap("cidade-" + palavraChave);
		         					}						
		         				}
		         			}

		         			//territorio por location e place usando cities
		         			for(i in cities){
		         				if(userLocation != null){
		         					if(searchWord(userLocation.toLowerCase(),i)){		         				
		         						insertOnMap("territorio-" + cities[i].estado,doc.status.id_str);
		         						insertOnMap("cidade-" + i,doc.status.id_str);		         						
		         					}
		         				}
		         				if(place_full_name != null){
		         					if(searchWord(place_full_name.toLowerCase(),i)){		         				
		         						insertOnMap("territorio-" + cities[i].estado,doc.status.id_str);
		         						insertOnMap("cidade-" + i,doc.status.id_str);						
		         					}
		         				}
		         			}

		         			//valida
		         			count++;
		         			if(count == queryResultCount){ 
		         				keys = Object.keys(updateMap);
								//console.log(updateMap);
								//db.close();
		         				sendUpdate(db,collection, keys, 0);
		         			}	
		      			}
		      		});
				});		
			}	
		});
	});
}

function sendUpdate(db, collection, keys, i){	

	if(queryResultCount>0){
	
	console.log(keys[i]+':\t' + updateMap[keys[i]].length + ' of '+ queryResultCount+' tweets ['+parseFloat(updateMap[keys[i]].length*100/queryResultCount).toFixed(2)+'%]')
	}

	query = { "status.id_str": { $in : updateMap[keys[i]] } };

    update = defineUpdate(keys[i]);

    options = { multi:true };		

	collection.update(query, update, options, function(err,update){
		if(err){ console.log(err);}

		if(i == keys.length-1){				
			db.close();
			console.log("conexão encerrada");
		}else{
			sendUpdate(db, collection, keys, i+1);
		}
	});		         				
}

function defineUpdate(key){
	if(S(key).startsWith("cidade-")){
		city = S(key).slice(7);
		cityData = cities[city];

		return {
			$addToSet: {categories: key},
			$set: {city_geo: [cityData.latitude , cityData.longitude]}			 
		};		
	}else{
		return { $addToSet: {categories: key} };
	}
}

function getUserList(){

	newUserList = [];

	pathPerfis = "produtos modelagem/perfis/twitter/";
	fileNames = [
				{file:"ATIVISTAS/Ativistas_gênero.xlsx", perfil:"ativista", tema:"genero"},
				{file:"ATIVISTAS/Ativistas_indígenas.xlsx", perfil:"ativista", tema:"indigena"},
				{file:"ATIVISTAS/Ativistas_lgbt.xlsx", perfil:"ativista", tema:"lgbt"},
				{file:"ATIVISTAS/Ativistas_negros.xlsx", perfil:"ativista", tema:"negros"},
				{file:"CELEBRIDADES/ModelagemPerfis_Celebridades.xlsx", perfil:"celebridades", tema:"getC", subcategoria:"getD"},
				{file:"MÍDIA/Midia_Independente_Perfis_FINAL.xlsx", perfil:"midia", tema:"getD", subcategoria:"independente", territorio:"getC"},
				{file:"MÍDIA/Midia_Institucional_Perfis_FINAL.xlsx", perfil:"midia", tema:"getD", subcategoria:"institucional", territorio:"getC"},
				{file:"MÍDIA/Midia_Tradicional_Perfis_FINAL.xlsx", perfil:"midia", subcategoria:"tradicional", territorio:"getC"},
				{file:"MOVIMENTOS SOCIAIS/Movimentos Sociais_gênero.xlsx", perfil:"movimentos-sociais", tema:"genero"},
				{file:"MOVIMENTOS SOCIAIS/Movimentos Sociais_indígenas.xlsx", perfil:"movimentos-sociais", tema:"indigena"},
				{file:"MOVIMENTOS SOCIAIS/Movimentos Sociais_lgbt.xlsx", perfil:"movimentos-sociais", tema:"lgbt"},
				{file:"MOVIMENTOS SOCIAIS/Movimentos Sociais_negros.xlsx", perfil:"movimentos-sociais", tema:"negros"},		
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
			/*sub = thisFileMetaData.subcategoria;
			if(!(sub === undefined)){
				sub = defineTema(sheet,sub);
				if(sub != null){ thisUser[0] = thisUser[0] + "-" + sub; }				
			}*/

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

function getTags(){	
	tags = {lgbt: [], negros:[], indigena:[], genero:[]};
	path = "produtos modelagem/conteudo/";
	tags.lgbt = getSubtemas(path + "Modelagem Tags_LGBT_final.xlsx");
	tags.negros = getSubtemas(path + "Modelagem Tags_NEGROS_final.xlsx");
	tags.indigena = getSubtemas(path + "Modelagem Tags_INDIGENAS_final.xlsx");
	tags.genero = getSubtemas(path + "Modelagem Tags_MULHER_final.xlsx");	
	//console.log(tags);
	mongoConnect(map,cities,tags);
}

function getSubtemas(filename){
	var sub = [];

	var workbook = xlsReader.readFile(filename);

	//pró
	var sheet = workbook.Sheets[workbook.SheetNames[0]];
	var pointer = 2;
	while(sheet['B' + pointer] != null){
		key = sheet['A' + pointer].v;
		key = trataEntrada(key);
		value = sheet['B' + pointer].v;
		sub[key.toLowerCase()] = {orientacao: "pro", conteudo: value.toLowerCase()};
		pointer++;
	}

	//contra
	pointer = 2;
	sheet = workbook.Sheets[workbook.SheetNames[1]];
	while(sheet['B' + pointer] != null){
		key = sheet['A' + pointer].v;
		key = trataEntrada(key);
		value = sheet['B' + pointer].v;
		sub[key] = {orientacao: "contra", conteudo: value.toLowerCase()};
		pointer++;
	}
	return sub;
}

function trataEntrada(key){
	//console.log(key);
	if (key.indexOf("\"") == -1){
		//console.log(S(key).replaceAll(" ", " + ").s.toLowerCase());
		return S(key).replaceAll(" ", " + ").s.toLowerCase();
	}else{
		splited = key.split("\"");
		r = (splited[0] == "") ? splited[1] : S(splited[0]).replaceAll(" ", " + ").s + splited[1];
		r = (splited[2] == "") ? r : r + S(splited[2]).replaceAll(" ", " + ").s;
		r = r.toLowerCase();
		//console.log(r);
		return r;		
	}
}



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

function searchWord(text,i){
	if(i.indexOf("+") > -1){
		parts = i.split(" + ");
		for(p in parts){
			if (!contains(text,parts[p])){return false;}
		}
		return true;
	}else{
		return contains(text,i);
	}
}

function contains(text,i){	
	index = text.indexOf(i); 
	if (index == -1){
		return false;
	}else{
		next = text.charAt(index + i.length);		
		var invalido = (index == 0) ? isAlpha(next) : ( isAlpha(next) || isAlpha(text.charAt(index-1)));
		if(invalido){
			cut = text.substring(index + i.length).indexOf(" ") + i.length + index;					
			if(cut==-1){return false;}
			return contains(text.substring(cut + 1),i);
		}else{
			return true;
		}
	}
}

function isAlpha(c){
	code = c.charCodeAt(0);
	if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123) && // lower alpha (a-z)
        !(code > 223 && code < 230) && 
        !(code > 230 && code < 240) &&
        !(code > 240 && code < 247) &&
        !(code > 248 && code < 253)){        
        return false;
    }else{    	
    	return true;
    }
}
