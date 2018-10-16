const Koa = require( 'koa' )
const app = new Koa()
const oas3 = require( './oas3' )
const config = require( './config.json' )

app.use( async (ctx, next) => {
	const start = Date.now()
	await next()
	const ms = Date.now() - start
	ctx.set( 'X-Response-time', `${ms}ms`)
})

app.use( oas3.consolelogger())
app.use( oas3.validate())
app.use( oas3.autorouter())

app.listen( config.serverListenPort )
