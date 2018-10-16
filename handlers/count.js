exports.one = function( ctx ) {
	ctx.body = 'One'
	ctx.status = 200
}

exports.two = function( ctx ) {
	ctx.body = 'Two'
	ctx.status = 200
}

exports.addOne = function( ctx ) {
	ctx.body = parseInt( ctx.query.add ) + 1
	ctx.status = 200
}
