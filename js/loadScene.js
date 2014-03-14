require([
	'goo/entities/GooRunner',
	'goo/loaders/DynamicLoader',
	'goo/addons/ammo/AmmoSystem',
	'goo/addons/ammo/AmmoComponent',
    'goo/math/Vector3',
    'js/VehicleHelper'
], function (
	GooRunner,
	DynamicLoader,
    AmmoSystem,
    AmmoComponent,
    Vector3,
    VehicleHelper
) {
	'use strict';

	function init() {
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

			var ammoSystem = new AmmoSystem();
			goo.world.setSystem(ammoSystem);
			

			// The loader takes care of loading the data
			var loader = new DynamicLoader({
				world: goo.world,
				rootPath: 'res',
				progressCallback: progressCallback
			});

			loader.load('root.bundle').then(function(result) {

				// Grab the first project in the bundle.
				var bundleKeys = Object.keys(result);
				var projectIds = bundleKeys.filter(function(k) {
					return /\.project$/.test(k);
				});
				var projectId = projectIds[0];
				if (!projectId) {
					alert('Error: No project in bundle'); // Should never happen
					return null;
				}
				
				return loader.load(projectId);

			}).then(function() {

				// This code will be called when the project has finished loading.
				goo.renderer.domElement.id = 'goo';
				document.body.appendChild(goo.renderer.domElement);

				// Application code goes here!

				// Process the world, so all entities, world bounds and worldTransforms are up to date.
				goo.world.process();
				
				// goo.world.by.name returns an goo/entities/EntitySelection object
				// see http://code.gooengine.com/latest/docs/World.html

				// Get all the duplicated star entities and give them real physical behavior using the AmmoComponent
				var stars = goo.world.getEntities().filter(function(e){return e.name=='Star'});
				stars.forEach(function(star) {
					star.setComponent(new AmmoComponent({mass:3, useWorldBounds:true, showBounds:false}));
				});
				var car  = goo.world.by.name('Car').first();
				var logo = goo.world.by.name('goo_logo_mesh').first();
				var prop = goo.world.by.name('prop_mesh').first();
				var cam  = goo.world.by.name('Default Camera').first();

				// make the logo collidable using the AmmoComponent.
				// AmmoComponents with a mass=0 are static and will not move.
				logo.setComponent(new AmmoComponent({mass:0, useWorldTransform:true}));
				// Lift the car a bit up, so it won't stick inside the logo. ( Remove this and see what happens )
				car.addTranslation(0,1,0);
				// Copy the car position so we can reset it, when we fall of the track
				var pos = car.getTranslation().clone();
				// You can think of the mass number as being in kilos.
				car.setComponent(new AmmoComponent({mass:350, useWorldBounds:true, showBounds:false}));
				// We use the helper class to make our car behave like a real car
				// It makes life easier when dealing with AmmoJS internal RayCastVehicle
				// The parameters are: goo, ammoSystem, chassis, wheelRadius, suspensionLength, doCreateDebugTire
				var vehicleHelper = new VehicleHelper(goo, ammoSystem, car, 2, 0.6, false);
				// The wheel axle is a vector that describes the orientation of the axle
				// Typical choices are the the x (1,0,0) axis or the z (0,0,1) axis.
				// Try setWheelAxle( -1, 0, 0); and see what happens.
				vehicleHelper.setWheelAxle( 1, 0, 0);
				// We add 4 wheels at the corners of the entity bounding box
				// If you want to be more precise you will have to position each wheel manually.
				// Look at the helper class to see how it is done.
				vehicleHelper.addDefaultWheels();
				//set a ScriptComponent that rotates the propeller around the UP axis.
				prop.set( function (entity, tpf) {
					entity.transformComponent.addRotation( 0, tpf*5, 0);
				});
				/*	The following code creates a script that makes the camera follow the car.
					First we create an aboveCar vector object that is set to a position 1 unit above the car
					and then a behindCar vector object that is set to a position 3 units behind
					and 2.5 units above the car.
					We then use the behindCar vector to linearly interpolate (lerp) the camera to that position
					Finally we make the camera lookAt at the aboveCar position.
					applyPost is a cool function of the rotation object (Matrix3x3) which applies it's rotation
					to the passed in vector object and because we want the vector to point behind the car
					we pass in a vector with a negative z value.
					You can think of it like putting the vector into the a local coordinate system of the car.
				*/
				var aboveCar = new Vector3();
				var behindCar = new Vector3();
				var camScriptObject = {};
				camScriptObject.run = function(entity,tpf) {
					var transform = car.transformComponent.transform;
					var pos = transform.translation;
					behindCar.setd(0,0,-3);
					transform.rotation.applyPost(behindCar);
					behindCar.addv(pos).add_d(0,2.5,0);
					entity.transformComponent.transform.translation.lerp(behindCar,0.05);
					entity.lookAt(aboveCar.setv(pos).add_d(0,1,0),Vector3.UNIT_Y);
				}
				
				// We replace the default Orbit camera behavior with our own from above
				cam.scriptComponent.scripts = [camScriptObject];
				// This is a code block I love to use to collect key presses
				var keys = new Array(127).join('0').split('').map(parseFloat); // prefill with 0s
				var keyHandler = function (e) {
					keys[e.keyCode] = e.type === "keydown" ? 1 : 0;
					if( keys[82]) { // r
						vehicleHelper.resetAtPos(pos.data[0], pos.data[1], pos.data[2]);
					}
				}
				document.body.addEventListener('keyup', keyHandler, false);
				document.body.addEventListener('keydown', keyHandler, false);

				var canvas = goo.renderer.domElement;
				var t = [];
				canvas.addEventListener( 'touchstart', function(event) {
				  for (var i = 0; i < event.touches.length; i++) {
					var touch = event.touches[i];
					t[i]={};
					t[i].pageX = touch.pageX;
					t[i].pageY = touch.pageY;
				  }
				}, false);
				
				canvas.addEventListener( 'touchmove', function(event) {
				  for (var i = 0; i < event.touches.length; i++) {
					var touch = event.touches[i];
					keys[37] = Math.min((t[i].pageX - touch.pageX)*0.01,1);
					keys[38] = Math.min((t[i].pageY - touch.pageY)*0.01,1);
				  }
				}, false);
				
				canvas.addEventListener( 'touchend', function(event) {
				  for (var i = 0; i < event.changedTouches.length; i++) {
					var touch = event.changedTouches[i];
					keys[37] = 0;
					keys[38] = 0;
				  }
				}, false);

				// Finally we add a goo callback function. This makes the last 3 lines of code being called every frame.
				// So every frame we check if one of the cursor keys is pressed and if so we call the
				// setSteeringValue or the applyEngineForce functions with values > 0.
				// This effectively accelerates and steers the car.
				// ( There is also a setBrake function available if you need that. )
				goo.callbacks.push(function() {
					vehicleHelper.setSteeringValue( keys[37] * 0.3 + keys[39] * -0.3);
					vehicleHelper.applyEngineForce( keys[38] * -700 + keys[40] * 500);
					vehicleHelper.applyEngineForce( keys[38] * -700 + keys[40] * 500, false);
				});

				// Start the rendering loop!
				goo.startGameLoop();

			}).then(null, function(e) {
				// If something goes wrong, 'e' is the error message from the engine.
				alert('Failed to load project: ' + e);
			});

		}
	}

	init();
});
