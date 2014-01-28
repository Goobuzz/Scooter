require([
    'goo/entities/GooRunner',
    'goo/statemachine/FSMSystem',
    'goo/addons/howler/systems/HowlerSystem',
    'goo/loaders/DynamicLoader',
	'goo/entities/components/ScriptComponent',
    'goo/addons/ammo/AmmoSystem',
    'goo/addons/ammo/AmmoComponent',
    'goo/math/Vector3',
    'js/VehicleHelper'
], function (
    GooRunner,
    FSMSystem,
    HowlerSystem,
    DynamicLoader,
    ScriptComponent,
    AmmoSystem,
    AmmoComponent,
    Vector3,
    VehicleHelper
) {
	'use strict';

	function init() {

		if (window.location.protocol==='file:') {
			alert('You need to run this webpage on a server. Check the code for links and details.');
			return;
		}

		// Make sure user is running Chrome/Firefox and that a WebGL context works
		var isChrome, isFirefox, isIE, isOpera, isSafari, isCocoonJS;
		isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
			isFirefox = typeof InstallTrigger !== 'undefined';
			isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
			isChrome = !!window.chrome && !isOpera;
			isIE = false || document.documentMode;
			isCocoonJS = navigator.appName === "Ludei CocoonJS";
		if (!(isFirefox || isChrome || isSafari || isCocoonJS || isIE === 11)) {
			alert("Sorry, but your browser is not supported.\nGoo works best in Google Chrome or Mozilla Firefox.\nYou will be redirected to a download page.");
			window.location.href = 'https://www.google.com/chrome';
		} else if (!window.WebGLRenderingContext) {
			alert("Sorry, but we could not find a WebGL rendering context.\nYou will be redirected to a troubleshooting page.");
			window.location.href = 'http://get.webgl.org/troubleshooting';
		} else {

			// Preventing brower peculiarities to mess with our control
			document.body.addEventListener('touchstart', function(event) {
				event.preventDefault();
			}, false);
			// Loading screen callback
			var progressCallback = function (handled, total) {
				var loadedPercent = (100*handled/total).toFixed();
				var loadingOverlay = document.getElementById("loadingOverlay");
				var progressBar = document.getElementById("progressBar");
				var progress = document.getElementById("progress");
				var loadingMessage = document.getElementById("loadingMessage");
				loadingOverlay.style.display = "block";
				loadingMessage.style.display = "block";
				progressBar.style.display = "block";
				progress.style.width = loadedPercent + "%";
			};

			// Create typical Goo application
			var goo = new GooRunner({
				antialias: true,
				manuallyStartGameLoop: true
			});
			var fsm = new FSMSystem(goo);
			goo.world.setSystem(fsm);
			goo.world.setSystem(new HowlerSystem());
			
			var ammoSystem = new AmmoSystem();
			goo.world.setSystem(ammoSystem);

			// The loader takes care of loading the data
			var loader = new DynamicLoader({
				world: goo.world,
				rootPath: 'res',
				progressCallback: progressCallback});

			loader.loadFromBundle('project.project', 'root.bundle', {recursive: false, preloadBinaries: true}).then(function(configs) {

				// This code will be called when the project has finished loading.
				goo.renderer.domElement.id = 'goo';
				document.body.appendChild(goo.renderer.domElement);

				// Application code goes here!
				
				goo.world.process();

				loader.getCachedObjectForRef('car/entities/prop_mesh_0.entity')
					.setComponent(new ScriptComponent({ run: function (entity) {
						entity.transformComponent.setRotation( 0, goo.world.time * 20, 0);
					}
				}));
				
				for( var k in configs)if(k[k.length-1] == 'y' ) {
					console.log(k);
					if( k.indexOf('star_plain/entities/RootNode') < 0 )
						continue;
					var star = loader.getCachedObjectForRef( k );
					star.setComponent(new AmmoComponent({mass:3, useWorldBounds:true, showBounds:false}));
				}

				var logo = loader.getCachedObjectForRef('goo_logo/entities/goo_logo_mesh_0.entity');
				logo.setComponent(new AmmoComponent({mass:0, useWorldTransform:true}));

				var car = loader.getCachedObjectForRef('car/entities/RootNode.entity');
				var pos = car.transformComponent.transform.translation.clone();
				car.setComponent(new AmmoComponent({mass:350, useWorldBounds:true, showBounds:false}));
				var vehicleHelper = new VehicleHelper(goo, ammoSystem, car, 2, 0.6, false);
				vehicleHelper.setWheelAxle( 1, 0, 0);
				vehicleHelper.addDefaultWheels();

				var cam = loader.getCachedObjectForRef('entities/ToolCamera.entity');
				cam.scriptComponent.scripts = [];
				car.transformComponent.attachChild( cam.transformComponent);
				cam.transformComponent.setTranslation(0,10,-10);
				cam.transformComponent.transform.rotation.lookAt( new Vector3(0,1,-1), new Vector3(0,1,0)); 

				var keys = new Array(127).join('0').split('').map(parseFloat); // prefill with 0s
				var keyHandler = function (e) {
					keys[e.keyCode] = e.type === "keydown" ? 1 : 0;
					if( keys[82]) { // r
						vehicleHelper.resetAtPos(pos.data[0], pos.data[1], pos.data[2]);
					}
				}
				document.body.addEventListener('keyup', keyHandler, false);
				document.body.addEventListener('keydown', keyHandler, false);
				goo.callbacks.push(function() {
					vehicleHelper.setSteeringValue( keys[37] * 0.3 + keys[39] * -0.3);
					vehicleHelper.applyEngineForce( keys[38] * -700 + keys[40] * 500);
					vehicleHelper.applyEngineForce( keys[38] * -700 + keys[40] * 500, false);
				});


				// Start the rendering loop!
				goo.startGameLoop();

			}).then(null, function(e) {
				// If something goes wrong, 'e' is the error message from the engine.
				console.log('Failed to load scene: ' + e.stack);
			});

		}
	}

	init();
});
