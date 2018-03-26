var args = process.argv;

//var userList = getUserList();
var territorios = getWordMap();
var count = 0;

// TODOS:
// Usar pacote node slug
// Descobrir o quê alguma não foram atualizadas. Coleta rodando?

function mongoConnect(map){
	var underscore = require('underscore');
	var utf8 = require('utf8')

	var MongoClient = require('mongodb').MongoClient;
	var teste = 0;

	mongouser = "labic";
	mongopsw = "labic";
	mongoip = "localhost";
	
	MongoClient.connect("mongodb://" + mongoip + "/twixplorer", {user:mongouser, pass:mongopsw}, function(err,db){
		if(err){
			console.log(err);
		}else{
			console.log("conectado");		
			var collection = db.collection("tweets");
			console.log(collection.count());

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
				query = new JSON(args[3]);
			}

			console.log(query);

			collection.count(query,function(err,count){
				if(err){console.log(err);}
				console.log(count);				
			});

			collection.find(query,function(err,search){
			
			search.each(function(err,doc){
				if (doc != null) {
					categories = [];
					categories.push("tema-" + doc.theme);									

	         		if(!(userList[doc.status.user.screen_name] === undefined)){	         			
	         			categories = underscore.union(userList[doc.status.user.screen_name].slice(),categories);	         			
	         		}
         			
	         		//territorio
	         		text = doc.status.text;
	         		for(i in map){
	         			if(searchWord(text.toLowerCase(),i.toLowerCase())){
	         				categories = underscore.union(categories,["territorio-" + map[i]]);						
	         			}
	         		}

	         		//console.log(doc.status.id_str);

	         		collection.update(
         				{
         					"status.id_str": doc.status.id_str
         				},
         				{
         					$set: { "categories": categories },
         					
         				},
         				{
         					multi:true
         				},
         				function(err, update) {
         					if (err) {
         						console.error('%j', err);
         					}else{
         						count++;
         						
         						//console.log(categories);
         						//console.log(doc);
         						//console.log(update.result);

         						if(count%1000 == 0){
         							console.log(count);
         						}
         					}
         			});
        		
	      		} else {
	         		console.log("null");
	         		//db.close();	         		
	      		}
			});
		});	
	}});
}

function getUserList(){

	xlsReader = require('xlsx');
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
			
			//TEMA
			/*tema = thisFileMetaData.tema;
			if(!(tema === undefined)){
				tema = defineTema(sheet,tema);
				if(tema != null){ thisUser.push("tema-" + tema) };
			}*/

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

function getWordMap(){
	map = [];

	var csv = require("fast-csv");
	csv.fromPath("produtos modelagem/territorio/palavras_regiao.csv")
 	.on("data", function(data){ 	
 		d = data[0]; 	
 		map[d] = data[1];
 	})
 	.on("end", function(){
 		mongoConnect(map); 	
 	});
}

function searchWord(text,i){
	if(i.indexOf("+") > -1){
		parts = i.split(" + ");
		for(p in parts){
			if (!contains(text,i)){return false;}
		}
		return true;
	}else{
		return contains(text,i);
	}
}

function contains(text,i){
	//console.log(text);
	index = text.indexOf(i); 
	if (index == -1){
		return false;
	}else{
		next = text.charAt(index + i.length);
		//console.log("next = "+ next);
		if(isAlpha(next)){
			cut = text.substring(index + i.length).indexOf(" ");		
			if(cut==-1){return false;}
			return contains(text.substring(cut + i.length + 1),i);
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