var player_set = {
	m_pos : 0,
	m_playing : false,
	m_scale : 2,
	m_backgroundShapeOffsets : null,
	m_foregroundShapeOffsets : null,
	m_palette : new Array( 16 ),
	m_shapePoints : null,
	m_rotationDataOffset : 0,

	init : function( canvas ) {
		this.m_canvas = document.getElementById( canvas );
	},

	start : function( pos ) {
		this.m_pos = 10;
		var frames = this.readWord( this.m_set, this.m_pos ); this.m_pos += 2;
		console.log( "frames=" + frames );
		this.m_rotationPos = this.m_rotationDataOffset;
		this.m_playing = true;
		this.m_timer = setInterval( function( ) { player_set.doTick( ) }, 100 );
	},

	stop : function( ) {
		this.m_playing = false;
		if ( this.m_timer ) {
			clearInterval( this.m_timer );
			this.m_timer = null;
		}
	},

	set_clipping : function( clip ) {
		this.m_scale = clip ? 1 : this.m_canvas.width / 240;
	},

	toSignedWord : function( value ) {
		return value - ((value & 0x8000) << 1);
	},

	doTick : function( ) {
		if ( !this.m_playing ) {
			return;
		}
		this.drawNextFrame( );
	},

	readPalette : function( offset ) {
		offset += 12;
		for ( var i = 0; i < 16; i++ ) {
			var color = this.readWord( this.m_set, offset ); offset += 2;
			var r = (color >> 8) & 15;
			var g = (color >> 4) & 15;
			var b =  color       & 15;
			this.m_palette[ i ] = '#' + r.toString( 16 ) + g.toString( 16 ) + b.toString( 16 );
		}
	},

	drawShape : function( context, shapeOffset ) {
		this.readPalette( shapeOffset.offset + shapeOffset.size ) ;

		var offset = shapeOffset.offset;
		var count = this.readWord( this.m_set, offset ); offset += 2;
		for ( var i = 0; i < count - 1; ++i ) {
			offset += 5; // shape_marker
			var verticesCount = this.readByte( this.m_set, offset ); ++offset;
			var ix = this.toSignedWord( this.readWord( this.m_set, offset ) ); offset += 2;
			var iy = this.toSignedWord( this.readWord( this.m_set, offset ) ); offset += 2;
			var color1 = this.readByte( this.m_set, offset ); ++offset;
			var color2 = this.readByte( this.m_set, offset ); ++offset;

			context.save( );
			context.fillStyle = context.strokeStyle = this.m_palette[ color1 ];
			if ( verticesCount == 255 ) {
				var rx = this.toSignedWord( this.readWord( this.m_set, offset ) ); offset += 2;
				var ry = this.toSignedWord( this.readWord( this.m_set, offset ) ); offset += 2;
				if ( rx > 0 && ry > 0 ) {
					context.translate( ix, iy );
					context.scale( rx, ry );
					context.beginPath( );
					context.arc( 0, 0, 1, 0, 2 * Math.PI, false );
					context.closePath( );
					context.fill( );
				}
			} else {
				context.beginPath( );
				for ( var j = 0; j < verticesCount; ++j ) {
					var x = this.toSignedWord( this.readWord( this.m_set, offset ) ); offset += 2;
					var y = this.toSignedWord( this.readWord( this.m_set, offset ) ); offset += 2;
					if ( j == 0 ) {
						context.moveTo( x, y );
					} else {
						context.lineTo( x, y );
					}
				}
				context.closePath( );
				if ( verticesCount < 2 ) {
					context.stroke( );
				} else {
					context.fill( );
				}
			}
			context.restore( );
		}
	},

	drawNextFrame : function( ) {
		var shape = this.readWord( this.m_set, this.m_pos ); this.m_pos += 2;
		if ( shape == 0xFFFF ) {
			this.m_playing = false;
			return;
		}
		var count = this.readWord( this.m_set, this.m_pos ); this.m_pos += 2;

		var context = this.m_canvas.getContext( '2d' );
		context.fillStyle = '#000';
		context.fillRect( 0, 0, this.m_canvas.width, this.m_canvas.height );
		context.save( );

		if ( this.m_scale == 1 ) {
			context.translate( ( this.m_canvas.width - 240 ) / 2, ( this.m_canvas.height - 128 ) / 2 );
		} else {
			context.scale( this.m_scale, this.m_scale );
		}

		this.drawShape( context, this.m_backgroundShapeOffsets[ shape ], 0, 0 );
		for ( var i = 0; i < count; ++i ) {
			var shape = this.readWord( this.m_set, this.m_pos ); this.m_pos += 2;
			var x = this.toSignedWord( this.readWord( this.m_set, this.m_pos ) ); this.m_pos += 2;
			var y = this.toSignedWord( this.readWord( this.m_set, this.m_pos ) ); this.m_pos += 2;
			context.save( );
			if ( this.m_rotationPos != 0 ) {
				var r1 = this.readWord( this.m_set, this.m_rotationPos ); this.m_rotationPos += 2;
				var r2 = this.readWord( this.m_set, this.m_rotationPos ); this.m_rotationPos += 2;
				console.assert( r2 == 180 );
				var r3 = this.readWord( this.m_set, this.m_rotationPos ); this.m_rotationPos += 2;
				console.assert( r3 == 90 );
				if ( r1 != 0 ) {
					context.translate( x + this.m_shapePoints[ shape ].ox, y + this.m_shapePoints[ shape ].oy );
					context.rotate( -r1 * Math.PI / 180 );
					x = -this.m_shapePoints[ shape ].ox;
					y = -this.m_shapePoints[ shape ].oy;
				}
			}
			context.translate( x, y );
			this.drawShape( context, this.m_foregroundShapeOffsets[ shape ] );
			context.restore( );
		}

		context.restore( );
	},

	readByte : function( data, offset ) {
		var value = data.charCodeAt( offset );
		return value;
	},

	readWord : function( data, offset ) {
		var value = data.charCodeAt( offset ) * 256;
		value += data.charCodeAt( offset + 1 );
		return value;
	},

	readShapeOffset : function( data, offset ) {
		var count = this.readWord( data, offset ); offset += 2;
		for ( var i = 0; i < count - 1; ++i ) {
			offset += 5; // shape_marker
			var verticesCount = this.readByte( data, offset ); ++offset;
			offset += 6;
			if ( verticesCount == 255 ) {
				offset += 4; // ellipse
			} else {
				offset += verticesCount * 4; // polygon
			}
		}
		return offset;
	},

	decode : function( data, offset ) {
		this.m_shapePoints = [ ];
		this.m_rotationDataOffset = 0;
		if ( offset == 0x822A ) {
			this.readRotationData( data, 0x443A );
		} else if ( offset == 0x3385 ) {
			this.readRotationData( data, 0x1A86 );
		}
		this.m_backgroundShapeOffsets = new Array( );
		var bgCount = this.readWord( data, offset ); offset += 2;
		console.log( "SET bg=" + bgCount );
		for ( var i = 0; i < bgCount; ++i ) {
			var nextOffset = this.readShapeOffset( data, offset );
			this.m_backgroundShapeOffsets.push( { offset : offset, size : nextOffset - offset } );
			offset = nextOffset + 45; // amiga_colors
		}
		this.m_foregroundShapeOffsets = new Array( );
		var fgCount = this.readWord( data, offset ); offset += 2;
		console.log( "SET fg=" + fgCount );
		for ( var i = 0; i < fgCount; ++i ) {
			var nextOffset = this.readShapeOffset( data, offset );
			this.m_foregroundShapeOffsets.push( { offset : offset, size : nextOffset - offset } );
			offset = nextOffset + 45; // amiga_colors
		}
		this.m_set = data;
	},

	readRotationData : function( data, offset ) {
		offset += 2;
		var count = this.readWord( data, offset ); offset += 2;
		for ( var i = 0; i < count; ++i ) {
			var ox = this.readWord( data, offset ); offset += 2;
			var oy = this.readWord( data, offset ); offset += 2;
			this.m_shapePoints.push( { ox : ox, oy : oy } );
		}
		offset += 2;
		this.m_rotationDataOffset = offset;
	}
}
