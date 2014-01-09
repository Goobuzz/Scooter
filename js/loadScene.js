require([
	'goo/entities/GooRunner',
	'goo/entities/EntityUtils',
	'goo/shapes/ShapeCreator',
	'goo/renderer/Material',
	'goo/renderer/shaders/ShaderLib',
	'goo/renderer/bounds/BoundingBox',
	'goo/addons/ammo/AmmoSystem',
	'goo/addons/ammo/AmmoComponent',
	'goo/scripts/OrbitCamControlScript',
	'goo/math/Vector3',
	'goo/statemachine/FSMSystem',
	'goo/entities/components/ScriptComponent',
	'goo/addons/howler/systems/HowlerSystem',
	'goo/loaders/DynamicLoader',
	'js/VehicleHelper'
], function (
	GooRunner, EntityUtils, ShapeCreator, Material, ShaderLib, BoundingBox, AmmoSystem, AmmoComponent, OrbitCamControlScript, Vector3,
	FSMSystem, ScriptComponent,
	HowlerSystem,
	DynamicLoader, VehicleHelper
) {
	'use strict';

	function init() {
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

			var ammoSystem = new AmmoSystem({stepFrequency:60});
			goo.world.setSystem(ammoSystem);


			// The loader takes care of loading the data
			var loader = new DynamicLoader({ world: goo.world, rootPath: 'res', progressCallback: progressCallback});

			loader.loadFromBundle('project.project', 'root.bundle', {recursive: false, preloadBinaries: true}).then(function(configs) {

				// This code will be called when the project has finished loading.
				goo.renderer.domElement.id = 'goo';
				document.body.appendChild(goo.renderer.domElement);
				
				for( var k in configs)if(k[k.length-1] == 'y' ) {
				  console.log(k);
				}

				//var carBody = loader.getCachedObjectForRef('car/entities/car_body_mesh_0.entity');
				var car = loader.getCachedObjectForRef('car/entities/RootNode.entity');
				var carProp = loader.getCachedObjectForRef('car/entities/prop_mesh_0.entity');
				carProp.setComponent(new ScriptComponent({
					run: function (entity) {
						entity.transformComponent.transform.setRotationXYZ(
						0,
						goo.world.time * 20,
						0);
						entity.transformComponent.setUpdated();
					}
				}));

				var logo = loader.getCachedObjectForRef('goo_logo/entities/goo_logo_mesh_0.entity');
				var star = loader.getCachedObjectForRef('star_plain/entities/star_plain_mesh_0.entity');
				star.setComponent(new AmmoComponent({mass:3, useWorldBounds:true, showBounds:false}));
				star.transformComponent.addTranslation( -0, 5, 5);

				car.transformComponent.addTranslation( -4, 5, 5);
				goo.world.process();

				logo.setComponent(new AmmoComponent({mass:0, useWorldTransform:true}));
				car.setComponent(new AmmoComponent({mass:350, useWorldBounds:true, showBounds:false}));

				var vehicleHelper = new VehicleHelper(goo, ammoSystem, car, 2, 0.6, false);
				vehicleHelper.setWheelAxle( 1, 0, 0);
				//vehicleHelper.doCreateDebugTire = true;
				vehicleHelper.addDefaultWheels();
				
				var cam = loader.getCachedObjectForRef('entities/DefaultToolCamera.entity');
				//var camScript=new OrbitCamControlScript({domElement : goo.renderer.domElement,//spherical : new Vector3(60, 5.15, Math.PI/7)});
				//cam.scriptComponent.scripts[0] = camScript;
				//var camScript = cam.scriptComponent.scripts[0];
				cam.scriptComponent.scripts = [];
				
				var box = goo.world.createEntity( ShapeCreator.createBox(10, 5, 1), Material.createMaterial(ShaderLib.simpleLit), [-5,0,5]).addToWorld();
				box.setComponent(new AmmoComponent());
				box.transformComponent.transform.setRotationXYZ(-Math.PI/3, Math.PI/2, 0);
				
				var extraArm = goo.world.createEntity();
				
				car.transformComponent.attachChild( extraArm.transformComponent);
				
				extraArm.transformComponent.attachChild( cam.transformComponent);

				
				
				cam.transformComponent.setTranslation(0,10,-10);
				cam.transformComponent.transform.rotation.lookAt( new Vector3(0,1,-1), new Vector3(0,1,0)); //setRotation();
				
				var keys = new Array(127).join('0').split('').map(parseFloat); // prefill with 0s
				var keyHandler = function (e) {
					keys[e.keyCode] = e.type === "keydown" ? 1 : 0;
					if( keys[82]) { // r
						vehicleHelper.resetAtPos(-4, 5, 5);
					}
				}
				document.body.addEventListener('keyup', keyHandler, false);
				document.body.addEventListener('keydown', keyHandler, false);
	
				var temp;
				goo.callbacks.push(function() {
					vehicleHelper.setSteeringValue( keys[37] * 0.3 + keys[39] * -0.3);
					vehicleHelper.applyEngineForce( keys[38] * -700 + keys[40] * 500);
					vehicleHelper.applyEngineForce( keys[38] * -700 + keys[40] * 500, false);
					vehicleHelper.updateWheelTransform();
					
					
					//temp = car.transformComponent.worldTransform.rotation.toAngles( temp);
					//console.log( car.transformComponent.worldTransform.translation.x);
					//camScript.goingToLookAt.set( car.transformComponent.worldTransform.translation);
					//camScript.lookAtPoint.lerp( car.transformComponent.worldTransform.translation, 0.5);
					//camScript.targetSpherical.add_d( 0, 0.01, 0); // temp.x
					//console.log( temp.x);
					//camScript.targetSpherical.lerp( new Vector3(camScript.targetSpherical.x, temp.x, camScript.targetSpherical.z), 0.3); // temp.x
					//camScript.move( 0.01, 0);
					//camScript.dirty = true;
				});


				// Application code goes here!

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
