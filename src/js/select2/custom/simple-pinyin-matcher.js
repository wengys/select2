define([
	"./simple-pinyin", 
	"../compat/matcher",
	"jquery",
	"jquery.select2"
	], function(simplePinyin,oldMatcher,$) {
	var pinyinMatcher = oldMatcher(function (term, text) {
            if (text.indexOf(term) >= 0) {
                return true;
            }
            var mod = simplePinyin(text);
            var termUpperCase = term.toUpperCase();
            var inFull = mod.full.toUpperCase().indexOf(termUpperCase) >= 0;
            var inShort = mod.short.toUpperCase().indexOf(termUpperCase) >= 0;
            return (inFull || inShort);
        })
    return pinyinMatcher;
})
