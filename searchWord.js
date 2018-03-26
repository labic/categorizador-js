{
exports.searchWord = function (text,i){
	if(text == null){ return false;}
	if(i.indexOf("+") > -1){
		parts = i.split(" + ");
		var p;
		for(p in parts){
			if (!contains(text,parts[p])){return false;}
		}
		return true;
	}else{
		return contains(text,i);
	}
},

contains = function (text,i){	
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
},

isAlpha = function(c){
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
}