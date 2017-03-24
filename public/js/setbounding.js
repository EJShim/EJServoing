
(function(){

	var owner, t, t_inv, sCTM, sCTM_inv;

	Object.defineProperty(
		SVGElement.prototype,
		'setBoundingClientRect', {
			'value' : function( rect, apply ){

				try{
					owner = this.ownerSVGElement;
					t = this.getTransformToElement( owner );
					t_inv = t.inverse();
				} catch( err ){
					return null;
				}

				var target = [
					P( rect.x, rect.y ),
					P( rect.x, rect.y + rect.height ),
					P( rect.x + rect.width, rect.y + rect.height ),
					P( rect.x + rect.width, rect.y )];

				var aabb = screenAABB.call( this );

				matrix = ( aabb ) ? getTransform.call( this, target, aabb ) : null;

				if( apply && matrix ){
					var transform = this.transform.baseVal;
					var item = transform
						.createSVGTransformFromMatrix( matrix );

					if( transform.numberOfItems == 0 ){
						transform.initialize( item );
					} else {
						transform.appendItem( item );
					}
				}
				return matrix;
			}
	});

	function P( x, y, mtr ){
		var p = owner.createSVGPoint();
			p.x = x || 0;
			p.y = y || 0;
		return ( mtr ) ? p.matrixTransform( mtr ) : p;
	}

	function screenAABB(){
		try{
			sCTM = owner.getScreenCTM();
			sCTM_inv = sCTM.inverse();
			var cr = this.getBoundingClientRect();
			return [P( cr.left, cr.top, sCTM_inv ),
				P( cr.left, cr.bottom, sCTM_inv ),
				P( cr.right, cr.bottom, sCTM_inv ),
				P( cr.right, cr.top, sCTM_inv )];

		} catch ( err ) {
			var bbox = this.getBBox();
			var p1 = { x :  Infinity, y :  Infinity };
			var p2 = { x : -Infinity, y : -Infinity };
			[P( bbox.x, bbox.y, t ),
			 P( bbox.x, bbox.y + bbox.height, t ),
			 P( bbox.x + bbox.width, bbox.y + bbox.height, t ),
			 P( bbox.x + bbox.width, bbox.y, t )]
				.forEach( function process( e, i , a ){
				p1.x = Math.min( p1.x, e.x );
				p1.y = Math.min( p1.y, e.y );
				p2.x = Math.max( p2.x, e.x );
				p2.y = Math.max( p2.y, e.y );
			});

			return [ P( p1.x, p1.y ), P( p1.x, p2.y ),
				P( p2.x, p2.y ), P( p2.x, p1.y ) ];
		}
		return null;
	}

	function getTransform( target, aabb ){
		var A = aabb[ 0 ],
			B = aabb[ 1 ],
			C = aabb[ 2 ],
			D = aabb[ 3 ];

		var U = P( A.x - C.x, A.y - C.y ),
			V = P( B.x - C.x, B.y - C.y );

		var DET = U.x * V.y - V.x * U.y;

		var A_t = target[ 0 ],
			B_t = target[ 1 ],
			C_t = target[ 2 ],
			D_t = target[ 3 ];

		var U_t = P( A_t.x - C_t.x, A_t.y - C_t.y ),
			V_t = P( B_t.x - C_t.x, B_t.y - C_t.y );

		var matrix = owner.createSVGMatrix();
			matrix.a = ( U_t.x * V.y - V_t.x * U.y ) / DET;
			matrix.b = ( U_t.y * V.y - V_t.y * U.y ) / DET;

			matrix.c = ( V_t.x * U.x - U_t.x * V.x ) / DET;
			matrix.d = ( V_t.y * U.x - U_t.y * V.x ) / DET;

			matrix.e = ( -C.x * ( U_t.x * V.y - V_t.x * U.y ) - C.y * ( V_t.x * U.x - U_t.x * V.x ) ) / DET + C_t.x;
			matrix.f = ( -C.x * ( U_t.y * V.y - V_t.y * U.y ) - C.y * ( V_t.y * U.x - U_t.y * V.x ) ) / DET + C_t.y;

			matrix = matrix.multiply( t );
			matrix = t_inv.multiply( matrix );
		return matrix;
	}
})();
