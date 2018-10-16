/********************************************************************
 * Set of Koa middleware for OpenAPI integration. Integrates
 * directly with swagger and pulls the api specs at each start
 * from URL defined in configuration.
 *
 * Requires config.json file with apiSourceUrl pointing to OAS3 YAML
 *
 * author: bm@hookon.cloud
 * license: MIT
 *
 ********************************************************************/

const yaml = require( 'js-yaml' )
const request = require( 'request' )
const config = require( './config.json' )

const apiYaml = config.apiSourceUrl

var api = {}

console.log( 'Loading API from '+config.apiSourceUrl )
request.get( apiYaml, function( err, resp, body ) {
	if ( !err && resp.statusCode == 200 ) {
		api = yaml.safeLoad( body, 'utf8' )
		return api
	} else {
		throw new Error( err )
	}
})

exports.autorouter = function() {
	/* autorouter() routes the call to the function
	 * loaded from external module. Handler is identified using operationId,
	 * which needs to consist of module.function string
   *
	 * autorouter() assumes ctx.request makes sense from api specs view
	 * (see validate()), but handler modules were not verified
	 *
	 * Parameters:
	 * ctx - holds koa context data (request and response data)
	 * next - points to next middleware in koa stack
	 *
	 */
	return async function( ctx, next ) {
		ctx.state.handler = 'oas3.autorouter'

		//verify of path is defined
		if ( api.paths[ ctx.request.path ] === undefined ) {
			ctx.status = 404
			ctx.message = `path ${ctx.request.path} not found`
			console.log( ctx.message )
		//verify if method for this path is defined
		} else if ( api.paths[ ctx.request.path ][ String( ctx.request.method ).toLowerCase()] === undefined ) {
			ctx.status = 405
			console.log( `405 method ${ctx.request.method} not allowed` )
		} else {
		//route to proper function from module
			var operationId = api.paths[ ctx.request.path ][ String( ctx.request.method ).toLowerCase() ].operationId

			var operationSplit = operationId.split('.')
			//TODO add error handling for unfound modules and handlers
			try {
				require.resolve( './handlers/'+operationSplit[0] )
			} catch ( err ) {
				ctx.status = 501
				ctx.message = `Error loading module ${operationSplit[0]}`
				console.log( ctx.message )
				return
			}
			const handlerMod = require( './handlers/'+operationSplit[0] )

			const handlerFunc = handlerMod[ operationSplit[ 1 ]]
			if ( handlerFunc === undefined ) {
				ctx.status = 501
				ctx.message = `Error loading handler ${operationId}`
				console.log( ctx.message )
				return
			}
			ctx.state.handler = operationId
			handlerFunc( ctx )

			await next()

		}
	}
} //router

exports.validate = function() {
	/* validate() validates ctx.request against (some) api specs defined
	 * in config.apiSourceurl
	 *
	 * Following tests are implemented:
	 *  - request path matches one of paths in schema
	 *  - method is defined in the schema for this path
	 *  - required query parameters are provided by user (checking names only)
	 *
	 */
	return async function( ctx, next ) {
			ctx.state.handler = 'oas3.validate'

      //verify of path is defined
      if ( api.paths[ ctx.request.path ] === undefined ) {
				//TODO: add support for parameters in paths
        ctx.status = 404
        ctx.message = `path ${ctx.request.path} not found`
      //verify if method for this path is defined
			} else if ( api.paths[ ctx.request.path ][ String( ctx.request.method ).toLowerCase()] === undefined ) {
        ctx.status = 405
        ctx.message = `method ${ctx.request.method} not allowed`
      } else {
				let apiAction = api.paths[ ctx.request.path ][ String( ctx.request.method ).toLowerCase()]
				if ( apiAction.parameters ) {
					//verify all parameters are defined
					apiAction.parameters.forEach( param => {
						if ( param.required ) {
							switch ( param.in ) {
								case 'query':
									if ( ctx.request.query[ param.name ] == undefined ) {
										ctx.status = 406
										ctx.message = `Parameter ${param.name} not defined`
									}
									break;
								default:
									//TODO: implement other parameter types: header, path, cookie
									;
							}
						} // if required
					}) //for each parameter
				} //parameters check
				//looks we're good to pass it on but let's check again
				try {
					await next()
				} catch ( err ) {
					;
				}
				//console.log( ctx.response )
			} // else
	} // async function
}

exports.consolelogger = function() {
  /* Simple request logger sending output to the console
	 *
	 */

	return async function( ctx, next ) {
		const start = Date.now()
		try {
			await next()
		} catch( err ) {
			;
		}
		const ms = Date.now() - start
		console.log( '[%s]: "%s %s" %s/%d %dms', new Date().toString(), ctx.request.method, ctx.request.path, ctx.state.handler, ctx.response.status, ms )
	}
}
