"use strict";

// Variable for beacon management library.
var beaconstmp = {}; 		// json for debouncing rssi read value direct from beacons.
var tmpBeaconTester = []; 	// JSON that transport the result of beaconState() to visualization. (should be used temporaryly)
var entered = 0;			// 0 or 'key' (uuid+major+minor)
var entered_small = 0;		// 0 or 'key' (uuid+major+minor)

// Viable for visualization Raphael Variable.
var paper = {};
var tx1 = {}; // big circle trigger value of the beacon
var tx2 = {}; // small circle trigger value of the beacon
var key = {}; // nearst beacon
var key2= {}; // locked beacon
var key3= {}; // beacon that being shown on to the graphic.
var key4= {}; // additional infos
var rect= {};
var bk  = {}; // rssiE value of this beacon.
var ln  = {};
var mid = 130; // reference middle point of the line
var rC  = 50;  // small circle radius
var rCb = 120; // big circle radius
var locked = undefined; // transporter from beacon module to visualization part.
var circle = {};
var circle2= {};

// Load info from beacon.json
var beaconLibrary = {};
$.getJSON("beacon.json", function(beacons)
{
	beaconLibrary = beacons; // load beacon json data.
	console.log("beacon library: ", JSON.stringify(beacons));
});


// The whole application body.
var app = (function(){

	var abb = {}; 			// Application object. the returned Object returned by "app"
	var regions =	[{uuid:'FDA50693-A4E2-4FB1-AFCF-C6EB07647825'}]; // Specify your beacon 128bit UUIDs here.
	var beacons = {}; 		// Dictionary of beacons.
	var updateTimer = null; // Timer that displays list of beacons.

	// Variable from react's "state"
	var bufferDepth = 3;	// How many scanned results should be stacked in the debouncing 
	var beaconsRSSI = []; 	// buffer object that save "bufferDepth" defined times 'beacons' object.
	var num = 0; 			// register to record beacon scan results' time.

	// This is the object that can be accessed from outside of the function.
	// It's "Global"
	abb.initialize = function(){
		document.addEventListener(
			'deviceready',
			function() { evothings.scriptsLoaded(onDeviceReady) },
			false);
	};

	function onDeviceReady(){
		// Specify a shortcut for the location manager holding the iBeacon functions.
		window.locationManager = cordova.plugins.locationManager;
		// Start tracking beacons!
		abb.startScan();
		// Display refresh timer.
		updateTimer = setInterval(displayBeaconList, 500);

		// INIT VISUALIZATION ELEMENTS.
		paper = Raphael(document.getElementById("visualization"),500,500);
		circle = paper.circle(mid,250,rCb);
		circle.attr("fill", "#f00");
		circle.attr("stroke", "green");
		circle.attr("opacity", 0.75);
		circle2 = paper.circle(mid,250,rC);
		circle2.attr("fill", "blue");
		circle2.attr("stroke", "green");
		circle2.attr("opacity", 0.5);
		var txParam = {fill:"#000","font-size":18};
		tx1 = paper.text(mid, 250-150-10, "test1").attr(txParam);
		tx2 = paper.text(mid, 250-80-10,  "test2").attr(txParam);
		var recParam = {fill:"#fff",stroke:"green",opacity:0.9};

		// The "moving part" of the visualization.
		rect = paper.rect(50,370,60,30,10).attr(recParam);
		bk = paper.text(50+60/2,370+30/2,"-67.55").attr(txParam);
		ln = paper.path("M80 370L80 10").attr(recParam).attr("stroke", "#333");		// Line moving with the box

		var txParam2 = {fill:"#000", "font-size":30, "text-anchor":"start"};
		var txParam3 = {fill:"#000", "font-size":18, "text-anchor":"start"};
		var title	 = paper.text(10,20,'Nearst:').attr(txParam2);

		// The in focus beacon. It can be the locking beacon or the beacon with nearst rssiE (averaged rssi)
		key = paper.text(10,50,"20:1").attr(txParam2);
		var title2 = paper.text(10,80,"Locked:").attr(txParam2);
		key2 = paper.text(10,110,"Locked").attr(txParam2);
		key3 = paper.text(mid, 250, "beacon").attr({fill:"#FFF", "font-size":30});
		var title3 = paper.text(10,400, "Info").attr(txParam2);
		key4 = paper.text(10,430, "waiting").attr(txParam3);

	}

	// Start scanning beacons
	abb.startScan = function(){
		var delegate = new locationManager.Delegate();

		// Called continuously when ranging beacons.
		delegate.didRangeBeaconsInRegion = function(pluginResult)
		{
			// Here will read in the beacon scan result & output the sorted beacon result. 
			beaconState(pluginResult);
		};

		// Called when starting to monitor a region.
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

	// Stop scanning beacons
	abb.stopScan = function(){
		for (var i in regions)
		{
			var beaconRegion = new locationManager.BeaconRegion(
				i + 1,
				regions[i].uuid);

			locationManager.stopRangingBeaconsInRegion(beaconRegion)
				.fail(console.error)
				.done();

			locationManager.stopMonitoringForRegion(beaconRegion)
				.fail(console.error)
				.done();
		}
	}


	function beaconfilter(beacons) {

		var returnBeacons = [];

		for (var i in beacons) {
			if (beacons[i].major == 12) {
				returnBeacons.push(beacons[i]);
			}
		}

		console.log("Filtered beacons: " + JSON.stringify(returnBeacons));

		return returnBeacons;
	}



	// The main part for scanning beacons & handling the results.
	// It's made of many parts working sequentially.
	function beaconState(pluginResult){


		var filteredBeacon = beaconfilter(pluginResult.beacons);

		// update beacon dictionary:
		for (var i in filteredBeacon)
		{
			// Insert beacon into table of found beacons.
			var beacon = filteredBeacon[i];
			beacon.timeStamp = Date.now();
			var key = beacon.uuid + ':' + beacon.major + ':' + beacon.minor;
			beacons[key] = beacon; // From here get the beacons array.
			beacon.numStamp = num;
		}

		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		///////////////////// DEBOUNCING RSSI VALUE /////////////////////////////////

		// Here I pass the beacons object into "Beacons rssi debouncing Buffer array"
		// new beacons (INPUT) -> BeaconBuffer -> debounced beacons (OUTPUT)

		function clone(obj) { // Make a copy of the new updated beacons object.
		    if (null == obj || "object" != typeof obj) return obj;
		    var copy = obj.constructor();
		    for (var attr in obj) {
		        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
		    }
		    return copy;
		}
		
		var arrayvar = beaconsRSSI.slice();
		arrayvar.unshift(clone(beacons)); 	// push new scan result from top.
		if(arrayvar.length > bufferDepth){
			arrayvar.pop(); 				// If stack deeper than 'bufferDepth', pop out the oldest one.
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

/*
		// The most up-to-Date 'numStamp' of the whole array.
		// Only be used for debug perpose.
		var maxNumStamp = 0; 
		$.each(beaconsRSSI, function(key,beacon){
			$.each(beacon, function(key_, beacon_){
				maxNumStamp = maxNumStamp > beacon_['numStamp'] ? maxNumStamp : beacon_['numStamp'];
			}.bind(this));
		}.bind(this));
		console.log('maxNumStamp: ' + maxNumStamp);
*/

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
			});
		});

		// Summing rssi value and buffer deep.
		$.each(beaconsRSSI, function(key,beacon){
			$.each(beacon, function(key_, beacon_){
				if(isNaN(beacon_['rssi'])){
					beacon_['rssi'] = 0; // When there is no signal, rssi return NaN
				}
				if(beacon_['rssi'] != 0){
					beaconstmp[key_].num += 1;
					beaconstmp[key_].rssiE_tmp = beaconstmp[key_].rssiE_tmp + beacon_['rssi'];
				}
			});
		});

		// Get average beacons RSSI attribute: "rssiE"
		$.each(beaconstmp, function(key,beacon){
			var rssiE = beacon.rssiE_tmp / beacon.num;
			beacons[key].rssiE = Number(rssiE.toFixed(2));
			if(isNaN(beacons[key].rssiE) == true){
				beacons[key].rssiE=-200;
			}
			beacons[key].accuracyE = "Empty";
		});

		num++;

		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		/////////////////////// SORTING BEACON LIST /////////////////////////////////

		var _beacons = []; // copy of all scanned beacons.

		// Make a copy from the original scan result
		$.each(beacons, function(key, beacon){
			_beacons.push(beacon);			
		});

/*		
	  	// Alternatively: 
		// SORT BEACON ACCORDING TO ITS ACCURANCY.
		// IN ORDER TO FIND OUT WHICH ONE THE NEARST ONE		
		_beacons.sort(function(a,b){ // Nearst to farst.
			return (a.accuracy - b.accuracy);
		});

		$.each(_beacons, function(key, beacon){
			if(key == 0){
				beacon.nearst = true;
			}else{
				beacon.nearst = false;
			}
		});
*/

		// SORT BEACON ACCORDING TO ITS EVERAGED RSSI
		_beacons.sort(function(a,b){ // Nearst to farst.
			return (b.rssiE - a.rssiE);
		});

		// MARK THE FIRST BEACONS AS THE NEARST ONE.
		$.each(_beacons, function(key, beacon){
			if(key == 0){
				beacon.nearst = true;
			}else{
				beacon.nearst = false;
			}
		});

/*
		// SORT BEACON ACCORDING TO ITS MINOR
		// IN ORDER TO LET EACH HAVE A FIX POSITION
		_beacons.sort(function(a,b){
			return (a.minor - b.minor);
		});
*/

/*
		// The following two modules are obsoleted because we do not calculating beacons distance 
		// according to their group.

		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		//////////////// BUILD 2D ARRAY ACCORDING TO MAJOR //////////////////////////

		// SORT BEACON ACCORDING TO ITS GROUP
		_beacons.sort(function(a,b){ 	// from small to big
			return (a.major - b.major);
		});				

		var object = []; // beacons array of beacons with same major
		var result = []; // Multi array save beacons with different major in different subarray
		var major_tmp =  _beacons[0].major;
		
		for(var i=0; i < _beacons.length; i++)
		{
			if(major_tmp == _beacons[i].major){
				object.push(_beacons[i]);
			}else{
				result.push(object);
				object = [];
				object.push(_beacons[i]);
				major_tmp = _beacons[i].major;
			}
			if(i == _beacons.length-1){
				result.push(object);
			}
		}

		// SORTING EACH GROUP IN RESULT.
		for (var i=0; i<result.length; i++){
			result[i].sort(function(a,b){
					return (b.rssiE - a.rssiE);
				}
			);
		}

		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		////////////////////// FIND THE NEARST GROUP ////////////////////////////////

		var groupNear = 0; //major value of the near group
		var averageDistance = -200; // when use accuracy -> 10
		var avg = 0;
		
		for(var i=0; i<result.length;i++){ // loop each sub array in it.
			if(result[i].length <= 3){
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

		$.each(_beacons,function(key, beacon){
			if(beacon.major == groupNear){
				beacon.nearGroup = true;
			} else {
				beacon.nearGroup = false;
			}
		});
*/
		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		//////////////////// ADD INFO FROM BEACON.JSON //////////////////////////////

		for (var i in _beacons)
		{
			var beacon = _beacons[i];
			beacon.timeStamp = Date.now();
			var key = beacon.uuid + ':' + beacon.major + ':' + beacon.minor;
			key = key.toUpperCase();
			// add some infomation from the JSON library into our final beacons object.
			beacon.triggerAddress   = beaconLibrary["beacons"][key]["triggerAddress"  ];
			beacon.triggerDistance  = beaconLibrary["beacons"][key]["triggerDistance" ];
			beacon.triggerDistanceI = beaconLibrary["beacons"][key]["triggerDistanceI"];
			beacon.triggerDistanceX = beaconLibrary["beacons"][key]["triggerDistanceX"];
		}

		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		////////////////////// BEACON ENTER-LOCKING /////////////////////////////////

		// When one beacon is entered & entered into its "entered_small", This module lock this
		// beacon as  the 'entered beacon'. Only when visiter leave the bigger circle of this
		// beacon, then the Lock is open, and other beacon can get the lock.
		// THE RESULT OF THIS MODULE WILL BE SENT FROM THIS PART THROUGH 'MEDIATOR'

		$.each(_beacons, function(key, beacon){
			var k = beacon.uuid + ':' + beacon.major + ':' + beacon.minor;
			var rE = beacon.rssiE;				// Averaged beacon rssi value.
			var tD = beacon.triggerDistance;	// big trigger distance circle of this beacon.
			var tDI= beacon.triggerDistanceI;	// small trigger distance circle of this beacon.
			var tDX= beacon.triggerDistanceX;   // the absolute trigger value for this beacon.
			if(entered == 0){
				if(rE >= tD){
					// mediator.publish("beacon.entered", beacon.triggerAddress);
					entered = k; // start lock
					key4.attr("text", "entered: big " + beacon.major + ":" + beacon.minor);
					if(rE >= tDI){
						//if(entered_small == 0){
							// mediator.publish("beacon.entered.small", beacon.triggerAddress);
							entered_small = k;
							// for (var member in myObject) delete myObject[member]; // This will empty this object.
							key4.attr("text", "entered: small " + beacon.major + ":" + beacon.minor);
							locked = {};
							locked.major = beacon.major;
							locked.minor = beacon.minor;
						//}
					}
				} 
			} else if (k == entered){ // When this beacon has the lock
				if(rE >= tDI){
					if(entered_small == 0){
						// mediator.publish("beacon.entered.small", beacon.triggerAddress);
						entered_small = k;
						key4.attr("text", "entered: small " + beacon.major + ":" + beacon.minor);
						locked = {};
						locked.major = beacon.major;
						locked.minor = beacon.minor;
					}
				} else if(rE < tD){
					// mediator.publish("beacon.left", beacon.triggerAddress);
					entered = 0; //free the lock
					entered_small = 0;
					key4.attr("text", "free lock: big");
					locked = undefined;
				} else if(rE < tDI && rE >= tD){
					if(entered_small == k){
						// mediator.publish("beacon.left.small", beacon.triggerAddress);
						key4.attr("text", "free lock: small");
						entered_small = 0; // ONLY when beacon leave the big circle will free this lock.
					}
				}
			}

			// if the nearst beacon has have the beacon small signal, It is surely be entered.
			if(beacon.nearst == true){
				if(rE > tDX){
					entered = k;
					entered_small = k;
					locked = {};
					locked.major = beacon.major;
					locked.minor = beacon.minor;
					key4.attr("text", "direct nearst: " + beacon.major + ":" + beacon.minor);
				}
			}
		});

		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		////////////////////// ******************** /////////////////////////////////

		// This is the last part. I push the out coming data array into another React Module.
		// For here it is useless.
		
/*		
		// zebra & majorOri are obsolated, only for old beacon list visualization.
		var zebra = false;
		var majorOri = _beacons[0].major;
		$.each(_beacons, function(key, beacon){
			if(majorOri != beacon.major){
				majorOri = beacon.major;
				zebra = !zebra;	
			}
		});
*/

		tmpBeaconTester = _beacons;
	}




		









	// Block to display things onto screen
	function displayBeaconList(){

		$('#found-beacons').empty(); // Clear beacon list.

		var timeNow = Date.now();

		// Do the sorting according to rssiE (averaged rssi value).
		tmpBeaconTester.sort(function(a,b){
			return b.rssiE - a.rssiE;
		});

		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		/////////////////////// Visualization part //////////////////////////////////

		var which = 0;	// decide the graphic showing the nearst beacon's parameter or the locked one.
		var cS = 60; 	// basic circle size
		var aD = 250;	// The speed of all animation.
		var bNO= tmpBeaconTester[0].major + ":" + tmpBeaconTester[0].minor;

		if(locked == undefined){
			// console.log("No locked beacon yet.");
			key2.attr("text", "none");
			circle2.animate({"fill":"blue", "opacity":0.6},aD);
		} else {
			var s = locked.major + ":" + locked.minor;
			// console.log("there is locked beacon:" + s);
			key2.attr("text", s);
			key3.attr("text", s);
			for(var i=0; i<tmpBeaconTester.length; i++){
				if(tmpBeaconTester[i].major == locked.major){
					if(tmpBeaconTester[i].minor == locked.minor){
						which = i;
						circle2.animate({"fill":"green", "opacity":0.9},aD);
					}
				}
			}
		}

		// Here use not the real "locking beacon" but the first one in the list.

		var rE = tmpBeaconTester[which].rssiE;
		var rD = tmpBeaconTester[which].triggerDistance;
		var rDI= tmpBeaconTester[which].triggerDistanceI;
		var bN = tmpBeaconTester[which].major + ":" + tmpBeaconTester[which].minor;
		
		tx1.attr("text", rD);
		tx2.attr("text", rDI);
		key.attr("text", bNO);

		if(which == 0){
			key3.attr("text", bN);
		}

		// The dynamic trigger circle.
		circle.animate({"r": cS-rD},aD); // 180 is the base size.
		circle2.animate({"r": cS-rDI},aD);

		// the moving 'pointer'
		bk.attr({"text":rE}); // change the text content.
		rect.animate({"x": cS-rE+mid-60/2}, aD);
		bk.animate({"x":cS-rE+mid}, aD);
		var a = cS-rE+mid;
		var ln_str = "M" + a + " 370L" + a + " 10";
		ln.animate({path: ln_str},aD);
		
		///////////////////////// MODULE DIVIDER ////////////////////////////////////
		////////////////////// LIST OF FOUND BEACONS ////////////////////////////////

		var rssiTip = $(
			'<button onclick="app.startScan()">start</button>&ensp;&ensp;&ensp;' +
			'<button onclick="app.stopScan()">stop</button>' +
			'<div>'
				+ 'trigger value of first beacon('
				+ tmpBeaconTester[0].major + ':' + tmpBeaconTester[0].minor + '):' + '<br />'
				+ '&ensp;big trigger circle   ' + tmpBeaconTester[0].triggerDistance + '<br />'
				+ '&ensp;small trigger circle ' + tmpBeaconTester[0].triggerDistanceI
			+ '</div>'
		);

		$('#warning').remove();
		$('#found-beacons').append(rssiTip);

		// Update beacon list.
		$.each(tmpBeaconTester, function(key, beacon)
		{
			// Only show beacons that are updated during the last 60 seconds.
			if (beacon.timeStamp + 60000 > timeNow)
			{
				// Map the RSSI value to a width in percent for the indicator.
				var rssiWidth = 1; // Used when RSSI is zero or greater.
				if (beacon.rssiE < -100) { rssiWidth = 100; }
				else if (beacon.rssiE < 0) { rssiWidth = 100 + beacon.rssiE; }

				// Create tag to display beacon data.
				var element = $(
					'<li>'
					+	'Major: ' + beacon.major + '&ensp;&ensp;'
					+	'Minor: ' + beacon.minor + '<br />'
					+	'RSSI: '  + beacon.rssi  + '&ensp;&ensp;&ensp;'
					+	'RSSIE: ' + beacon.rssiE + '<br />'
					+	'rD: ' + beacon.triggerDistance + '&ensp;&ensp;'
					+	'rDI: ' + beacon.triggerDistanceI + '&ensp;&ensp;'
					+	'rDX: ' + beacon.triggerDistanceX + '<br />'
					+ 	'<div style="background:rgb(255,128,64);height:20px;width:'
					+ 		rssiWidth + '%;"></div>'
					+ '</li>'
				);

				$('#warning').remove();
				$('#found-beacons').append(element);
			}
		});
	}

	return abb;
}()); // from here inject the library of beaconinfo.

app.initialize();

