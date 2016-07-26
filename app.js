"use strict"

// var beacons = {}; // available beacon list.
var beaconstmp = {}; // json for debouncing







var beaconLibrary = {};
jQuery.getJSON("beacon.json", function(beacons)
{
	beaconLibrary = beacons;
});






var app = (function(bLibrary){

	// console.log("Hi abc " + JSON.stringify(bLibrary));
	// console.log("Hi abc " + JSON.stringify(beaconLibrary));

	var app = {}; 	// Application object.
	// Specify your beacon 128bit UUIDs here.
	var regions =	[{uuid:'FDA50693-A4E2-4FB1-AFCF-C6EB07647825'}];
	var beacons = {}; // Dictionary of beacons.
	// Timer that displays list of beacons.
	var updateTimer = null;

	// Variable from react's "state"
	var activeTourID = "", // comment test
		activeTour = "",
		dict = "",
		beaconComponents = [],
		bufferDepth = 3,
		beaconsRSSI = [],
		beaconNear = undefined,
		num = 0,
		entered = 0,
		entered_small = 0,
		radio_small = -60;
	







	app.initialize = function(){
		document.addEventListener(
			'deviceready',
			function() { evothings.scriptsLoaded(onDeviceReady) },
			false);
	};

	function onDeviceReady(){
		// Specify a shortcut for the location manager holding the iBeacon functions.
		window.locationManager = cordova.plugins.locationManager;
		// Start tracking beacons!
		startScan();
		// Display refresh timer.
		updateTimer = setInterval(displayBeaconList, 500);
	}








	// Handling the beacons
	function startScan(){
		// The delegate object holds the iBeacon callback functions
		// specified below.
		var delegate = new locationManager.Delegate();

		// Called continuously when ranging beacons.
		delegate.didRangeBeaconsInRegion = function(pluginResult)
		{
			// console.log('didRangeBeaconsInRegion: ' + JSON.stringify(pluginResult))
			for (var i in pluginResult.beacons)
			{
				// Insert beacon into table of found beacons.
				var beacon = pluginResult.beacons[i];
				beacon.timeStamp = Date.now();
				var key = beacon.uuid + ':' + beacon.major + ':' + beacon.minor;
				beacons[key] = beacon; // From here get the beacons array.
			}
			// Here will read in the beacon scan result & output the sorted beacon result. /////////////////////////////////			
			beaconState(pluginResult);
		};

		// Called when starting to monitor a region.
		// (Not used in this example, included as a reference.)
		delegate.didStartMonitoringForRegion = function(pluginResult)
		{
			// console.log('didStartMonitoringForRegion:' + JSON.stringify(pluginResult))
		};

		// Set the delegate object to use.
		locationManager.setDelegate(delegate);

		// Request permission from user to access location info.
		// This is needed on iOS 8.
		locationManager.requestAlwaysAuthorization();

		// Start monitoring and ranging beacons.
		for (var i in regions)
		{
			var beaconRegion = new locationManager.BeaconRegion(
				i + 1,
				regions[i].uuid);

			// Start ranging.
			locationManager.startRangingBeaconsInRegion(beaconRegion)
				.fail(console.error)
				.done();

			// Start monitoring.
			// (Not used in this example, included as a reference.)
			locationManager.startMonitoringForRegion(beaconRegion)
				.fail(console.error)
				.done();
		}
	}









	function beaconState(pluginResult){
		// update beacon dictionary:
		for (var i in pluginResult.beacons)
		{
			var beacon = pluginResult.beacons[i];
			// beacon.timeStamp = Date.now(); // There is already timeStamp build in. this will override it(?)
			beacon.numStamp = num;

			var key = beacon.uuid + ':' + beacon.major + ':' + beacon.minor;
			// build up main beacons object with all available (appeared at leat onces) beacons in it.
			beacons[key] = beacon;			
		}

		// Here I pass the beacons object into "Beacons Buffer System"
		// beacons (INPUT) -> BeaconBuffer() -> beacons (OUTPUT)
		function clone(obj) { // Make a copy of the new updated beacons object.
		    if (null == obj || "object" != typeof obj) return obj;
		    var copy = obj.constructor();
		    for (var attr in obj) {
		        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
		    }
		    return copy;
		}
		
		var arrayvar = beaconsRSSI.slice();
		arrayvar.unshift(clone(beacons)); // push new scan result from top.
		if(arrayvar.length > bufferDepth){
			arrayvar.pop(); // If stack deeper as 'bufferDepth', pop out the deepst.
		}

		beaconsRSSI = arrayvar; // beaconsRSSI is 2D array.

/*
		// Demo log out the buffer system working status.
		var cl = '';
		$.each(beaconsRSSI, function(key,beacon){
			cl += beacon["fda50693-a4e2-4fb1-afcf-c6eb07647825:10:1"]["numStamp"] + " ";
		});	
		console.log(cl); // show object in different layer have different numStamp.
*/

		var maxNumStamp = 0; // The most up-to-Date 'numStamp' of the whole array.
		$.each(beaconsRSSI, function(key,beacon){
			$.each(beacon, function(key_, beacon_){
				maxNumStamp = maxNumStamp > beacon_['numStamp'] ? maxNumStamp : beacon_['numStamp'];
			}.bind(this));
		}.bind(this));
		// console.log('maxNumStamp: ' + maxNumStamp);

		// Zeroing & Init properties.
		$.each(beaconsRSSI, function(key,beacon){
			$.each(beacon, function(key_, beacon_){
				if(beaconstmp[key_] == undefined){
					beaconstmp[key_] = {};
					beaconstmp[key_].rssiE = 0;
					beaconstmp[key_].accuracyE = 0;
				} 
					beaconstmp[key_].num = 0;
					beaconstmp[key_].rssiE_tmp = 0;
					beaconstmp[key_].accuracyE_tmp = 0;
			}.bind(this));
		}.bind(this));

		$.each(beaconsRSSI, function(key,beacon){
			$.each(beacon, function(key_, beacon_){
				if(isNaN(beacon_['rssi']) == true){
					beacon_['rssi'] = 0; // When there is no signal, rssi return NaN
				}
				if(beacon_['rssi'] != 0){
					beaconstmp[key_].num += 1;
					beaconstmp[key_].rssiE_tmp = beaconstmp[key_].rssiE_tmp + beacon_['rssi'];
				}
			}.bind(this));
		}.bind(this));

		$.each(beaconstmp, function(key,beacon){
			var rssiE = beacon.rssiE_tmp / beacon.num;
			beacons[key].rssiE = Number(rssiE.toFixed(2));
			if(isNaN(beacons[key].rssiE) == true){
				beacons[key].rssiE=-200;
			}
			beacons[key].accuracyE = "Empty";
			// console.log('beacons[key].rssiE & num:' + beacons[key].rssiE + " " + beacon.rssiE_tmp + " " + beacon.num);
		});

		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		// this.setState({num : this.state.num+1}); // increment number tag of beacons.
		num++;

		var _beacons = [];
		var _beacons_tmp = [];

		$.each(beacons, function(key, beacon){
			_beacons_tmp.push(beacon);			
		}.bind(this));
		
	/*
		// SORT BEACON ACCORDING TO ITS ACCURANCY.
		// IN ORDER TO FIND OUT WHICH ONE THE NEARST ONE		
		_beacons_tmp.sort(function(a,b){ // Nearst to farst.
			return (a.accuracy - b.accuracy);
		});

		$.each(_beacons_tmp, function(key, beacon){
			if(key == 0){
				beacon.nearst = true;
			}else{
				beacon.nearst = false;
			}
		});
	*/

		// SORT BEACON ACCORDING TO ITS RSSI
		_beacons_tmp.sort(function(a,b){ // Nearst to farst.
			return (b.rssiE - a.rssiE);
		});

		$.each(_beacons_tmp, function(key, beacon){
			if(key == 0){
				beacon.nearst = true;
			}else{
				beacon.nearst = false;
			}
		});

		// SORT BEACON ACCORDING TO ITS MINOR
		// IN ORDER LET EACH HAVE A FIX POSITION
		_beacons_tmp.sort(function(a,b){
			return (a.minor - b.minor);
		});
		// SORT BEACON ACCORDING TO ITS GROUP
		_beacons_tmp.sort(function(a,b){
			return (a.major - b.major);
		});

		var object = []; // beacons array of beacons with same major
		var result = []; // Multi array save beacons with different major in different subarray
		var major_tmp =  _beacons_tmp[0].major;
		
		for(var i=0; i < _beacons_tmp.length; i++)
		{
			if(major_tmp == _beacons_tmp[i].major){
				object.push(_beacons_tmp[i]);
				if(i == _beacons_tmp.length-1){
					result.push(object);
				}
			}else{
				result.push(object);
				object = [];
				object.push(_beacons_tmp[i]);
				major_tmp = _beacons_tmp[i].major;
			}				
		}

		var groupNear = 0; //major value of the near group
		var averageDistance = -200; // when use accuracy -> 10
		var avg = 0;		
		for(var i=0; i<result.length;i++){
			if(result[i].length <= 3){
				//console.log("avg start value: " + avg);
				for(var j=0; j<result[i].length; j++){
					avg += result[i][j].rssiE; //change "accuracy" to "rssi" when wanna based on rssi.
				}
				avg = avg / result[i].length;
			} else {
				for(var j=0; j<3; j++){
					avg += result[i][j].rssiE;
				}
				avg = avg / 3;
			}
			
			if(avg > averageDistance){ // when use accuracy -> <, when use rssi -> >
				averageDistance = avg;
				groupNear = result[i][0].major;			
			} else if(averageDistance == -200){ // when use accuracy -> 10, when use rssi -> -200
				groupNear = result[i][0].major;	
			}
			avg = 0; 
		}

		$.each(_beacons_tmp,function(key, beacon){
			if(beacon.major == groupNear){
				beacon.nearGroup = true;
			} else {
				beacon.nearGroup = false;
			}
		});

		// build beacons object with in info from beacon.json
		for (var i in _beacons_tmp)
		{
			var beacon = _beacons_tmp[i];
			beacon.timeStamp = Date.now();
			var key = beacon.uuid + ':' + beacon.major + ':' + beacon.minor;
			key = key.toUpperCase();
			// From here, we indexing the beacon library and try to add some infomation from 
			// the JSON library into our final beacons object.
			beacon.triggerAddress = beaconLibrary["beacons"][key]["triggerAddress"]; // this.props
			beacon.triggerDistance = beaconLibrary["beacons"][key]["triggerDistance"];
			beacon.triggerDistanceI = beaconLibrary["beacons"][key]["triggerDistanceI"];
		}

		////////////// MODULE DIVIDER //////////////////////////////////
		///////////// "Enter-Locking Module" ///////////////////////////
		// When one beacon is entered and entered into "entered_small", This module lock this
		// beacon as the entered beacon. Only when visiter leave the bigger circle of this beacon,
		// Then the Lock is open, and new beacon can be sets as the new beacon that locking focus.
		// TODO: Transmit the status of each beacon from BLE.jsx into Beacon.jsx to do visuallization.
		$.each(_beacons_tmp, function(key, beacon){
			var k = beacon.uuid + ':' + beacon.major + ':' + beacon.minor;
			var rE = beacon.rssiE;
			var tD = beacon.triggerDistance;
			var tDI= beacon.triggerDistanceI;
			if(entered == 0){
				if(rE >= tD){
					// mediator.publish("beacon.entered", beacon.triggerAddress);
					// this.setState({entered: k}); // start lock
					entered = k;
					// console.log('beacon entered:' + k);
					if(rE >= tDI){
						if(entered_small == 0){
							// mediator.publish("beacon.entered.small", beacon.triggerAddress);
							// this.setState({entered_small: k});
							entered_small = k;
							// console.log('enter beacon small:' + k);
						}
					}
				} 
			} else if(k == entered){ // When this beacon has the lock
				if(rE >= tDI){
					if(entered_small == 0){
						// mediator.publish("beacon.entered.small", beacon.triggerAddress);
						//this.setState({entered_small: k});
						entered_small = k;
						// console.log('enter beacon small:' + k);
					}
				} else if(rE < tD){
					// mediator.publish("beacon.left", beacon.triggerAddress);
					// this.setState({entered: 0}); //free the lock
					entered = 0;
					// this.setState({entered_small: 0});
					entered_small = 0;
					// console.log('beacon left:' + k);
					// console.log(beacon.rssiE);
				} else if(rE < tDI && rE >= tD){
					if(entered_small == k){
						// mediator.publish("beacon.left.small", beacon.triggerAddress);
						// this.setState({entered_small: 0}); // ONLY when beacon leave the big circle will free this lock. (Debouncing)
						// console.log('enter left small:' + k);
						// console.log(beacon.rssiE);
					}
				} else {
					// When 'this' beacon is not the locking one, and one beacon is setten.
					// console.log('lock beacon: ' + k);
				}
			}
		}.bind(this));

		////////////// MODULE DIVIDER //////////////////////////////////

		// This is the last part, that I push the out coming data array into another React Module
		var zebra = false;
		var majorOri = _beacons_tmp[0].major;
		$.each(_beacons_tmp, function(key, beacon){
			if(majorOri != beacon.major){
				majorOri = beacon.major;
				zebra = !zebra;	
			}	
		});

		/*this.setState(function(state){ 
			return{ 
				beaconComponents : _beacons, // The final product.
				dict : JSON.stringify(beacons)
			}
		});*/

	}









	// Block to display things onto screen
	function displayBeaconList(){
		// Clear beacon list.
		$('#found-beacons').empty();

		var timeNow = Date.now();

		// Update beacon list.
		$.each(beacons, function(key, beacon)
		{
			// Only show beacons that are updated during the last 60 seconds.
			if (beacon.timeStamp + 60000 > timeNow)
			{
				// Map the RSSI value to a width in percent for the indicator.
				var rssiWidth = 1; // Used when RSSI is zero or greater.
				if (beacon.rssi < -100) { rssiWidth = 100; }
				else if (beacon.rssi < 0) { rssiWidth = 100 + beacon.rssi; }

				// Create tag to display beacon data.
				var element = $(
					'<li>'
					+	'<strong>UUID: ' + beacon.uuid + '</strong><br />'
					+	'Major: ' + beacon.major + '<br />'
					+	'Minor: ' + beacon.minor + '<br />'
					+	'Proximity: ' + beacon.proximity + '<br />'
					+	'RSSI: ' + beacon.rssi + '<br />'
					+ 	'<div style="background:rgb(255,128,64);height:20px;width:'
					+ 		rssiWidth + '%;"></div>'
					+ '</li>'
				);

				$('#warning').remove();
				$('#found-beacons').append(element);
			}
		});
	}

	return app;
}(beaconLibrary)); // from here inject the library of beaconinfo.

app.initialize();


