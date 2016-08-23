/*
 * View model for OctoPrint-Pidtune
 *
 * Author: Tom Haraldseid
 * License: AGPLv3
 */


$(function() {
    function PidtuneViewModel(parameters) {
        var self = this;

        self.loginState = parameters[0];
        self.settingsViewModel = parameters[1];
        
        self.isErrorOrClosed = ko.observable(undefined);
        self.isOperational = ko.observable(undefined);
        self.isPrinting = ko.observable(undefined);
        self.isPaused = ko.observable(undefined);
        self.isError = ko.observable(undefined);
        self.isReady = ko.observable(undefined);
        self.isLoading = ko.observable(undefined);
        
        self.max_plot = 100;
        self.actTemp = [];
        self.targetTemp = [];
        self.selectedController = ko.observable("Tool0") 
        self.tempControllers = ko.observableArray(["Tool0", "Tool1", "Bed"])
        
        self.pidData = {};
        
        self.pidData.bias = ko.observable("-");
        self.pidData.min = ko.observable("-");
        self.pidData.max = ko.observable("-");
        self.pidData.ku = ko.observable("40");
        self.pidData.tu = ko.observable("20");
        self.pidData.kp = ko.observable("0");
        self.pidData.ki = ko.observable("0");
        self.pidData.kd = ko.observable("0");
        self.pidData.ti = ko.observable("0");
        self.pidData.td = ko.observable("0");
        self.pidData.model = ko.observable("cl")
        
        self.target = ko.observable("200");
        self.cycles = ko.observable("8");
        self.stepSize = ko.observable("10");
        
        self.pidAutoState = ko.observable("Ready");
        
        self._printerProfileUpdated = function() {
            
        	var tempArray = [];
            

            // tools
            var numExtruders = self.settingsViewModel.printerProfiles.currentProfileData().extruder.count();
            if (numExtruders) {
               
                for (var extruder = 0; extruder < numExtruders; extruder++) {
                   tempArray.push('Tool' + extruder);
                }
            } 

            console.log('Heated bed:');
            // print bed
            if (self.settingsViewModel.printerProfiles.currentProfileData().heatedBed()) {
            	tempArray.push('Bed');
            	
            }
            
            self.tempControllers(tempArray);

        };
        
        self.settingsViewModel.printerProfiles.currentProfileData.subscribe(function() {
            self._printerProfileUpdated();
            self.settingsViewModel.printerProfiles.currentProfileData().extruder.count.subscribe(self._printerProfileUpdated);
            self.settingsViewModel.printerProfiles.currentProfileData().heatedBed.subscribe(self._printerProfileUpdated());
        });
        
        self.updatePidDataK = function(newValue) {
        	self.pidData.kp(self.pidData.kpCo());
        	self.pidData.ki(self.pidData.kiCo());
        	self.pidData.kd(self.pidData.kdCo());
        };
        
        self.updatePidDataT = function(newValue) {
        	self.pidData.ti(self.pidData.tiCo());
        	self.pidData.td(self.pidData.tdCo());
        };
        
        
        
        self.pidData.kpCo = ko.computed(function() {
        	switch (self.pidData.model()) {
        	
        	case "cl":
        		return 0.6 * parseFloat(self.pidData.ku())        		
        		break;
        	case "pe":
        		return 0.7 * parseFloat(self.pidData.ku()) 
        		break;
        	case "so":
        		return 0.33 * parseFloat(self.pidData.ku()) 
        		break;
        	case "no":
        		return 0.2 * parseFloat(self.pidData.ku()) 
        		break;
        	}
        });
        
        
        
        self.pidData.kiCo = ko.computed(function() {
        	switch (self.pidData.model()) {
        	
        	case "cl":
        	case "so":
        	case "no":
        		return 2.0 * parseFloat(self.pidData.kp()) / parseFloat(self.pidData.tu())     		
        		break;
        	case "pe":
        		return 2.5 * parseFloat(self.pidData.kp()) / parseFloat(self.pidData.tu()) 
        		break;
        	}
        });
        
        self.pidData.kdCo = ko.computed(function() {
        	switch (self.pidData.model()) {
        	
        	case "cl":
        		return parseFloat(self.pidData.kp()) * parseFloat(self.pidData.tu()) / 8.0   		
        		break;
        	case "pe":
        		return 3.0 * parseFloat(self.pidData.kp()) * parseFloat(self.pidData.tu()) / 20.0
        		break;
        	case "so":
        	case "no":
        		return parseFloat(self.pidData.kp()) * parseFloat(self.pidData.tu()) / 3.0
        		break;
        	}
        });
        
        self.pidData.tiCo = ko.computed(function() {
        	return parseFloat(self.pidData.kp()) / parseFloat(self.pidData.ki())
        	
        });
        
        self.pidData.tdCo = ko.computed(function() {
        	return parseFloat(self.pidData.kd()) / parseFloat(self.pidData.kp())
        	
        });
        
        self.pidData.tu.subscribe(self.updatePidDataK);
        self.pidData.ku.subscribe(self.updatePidDataK);
        self.pidData.model.subscribe(self.updatePidDataK);
        self.pidData.kp.subscribe(self.updatePidDataT);
        self.pidData.ki.subscribe(self.updatePidDataT);
        self.pidData.kd.subscribe(self.updatePidDataT);
        self.pidData.ti.subscribe(function(newValue) {self.pidData.ki(self.pidData.kp() / newValue)});
        self.pidData.td.subscribe(function(newValue) {self.pidData.kd(self.pidData.kp() * newValue)});
        
        
        self.autoBtn = function() {
        	if (self.selectedController().slice(0,4) == 'Tool') {
        			self.sendCommand("M303 E" + self.selectedController().slice(4,5) + " S" + self.target() + " C" + self.cycles());
        			
        	}else if (self.selectedController() == 'Bed') {
        			self.sendCommand("M303 E-1 S" + self.target() + " C" + self.cycles());
        			
        	}
        	
        	self.pidAutoState("Running");
        };
        
        self.manualBtn = function() {
        	
        	if (self.selectedController().slice(0,4) == 'Tool') {
        			self.sendCommand("M104 T" + self.selectedController().slice(4,5) + " S" + self.target());
        			
        	}else if (self.selectedController() == 'Bed') {
        			self.sendCommand("M140 S" + self.target());
        			
        	}
        	
        };
        
        self.incBtn = function() {
        	var newTarget = parseFloat(self.currentTargetTemp) + parseFloat(self.stepSize());
        	
        	if (self.selectedController().slice(0,4) == 'Tool') {
        			self.sendCommand("M104 T" + self.selectedController().slice(4,5) + " S" + newTarget);
        			
        	}else if (self.selectedController() == 'Bed') {
        			self.sendCommand("M140 S" + newTarget);
        			
        	}
        	
        	
        };
        
        self.decBtn = function() {
        	var newTarget = parseFloat(self.currentTargetTemp) - parseFloat(self.stepSize());
        	
        	if (self.selectedController().slice(0,4) == 'Tool') {
        			self.sendCommand("M104 T" + self.selectedController().slice(4,5) + " S" + newTarget);
        			
        	}else if (self.selectedController() == 'Bed') {
        			self.sendCommand("M140 S" + newTarget);
        			
        	}
        };
        
        self.offBtn = function() {
        	
        	if (self.selectedController().slice(0,4) == 'Tool') {
        			self.sendCommand("M104 T" + self.selectedController().slice(4,5) + " S0");
        			
        	}else if (self.selectedController() == 'Bed') {
        			self.sendCommand("M140 S0");
        			
        	}
        	
        	
        };
        
        self.applyBtn = function() {
        	
        	if (self.selectedController().slice(0,4) == 'Tool') {
        			self.sendCommand("M301 E" + self.selectedController().slice(4,5) + " P" + self.pidData.kp() + " I" + self.pidData.ki() + " D" + self.pidData.kd());
        			
        	}else if (self.selectedController() == 'Bed') {
        			self.sendCommand("M304 P" + self.pidData.kp() + " I" + self.pidData.ki() + " D" + self.pidData.kd());
        			
        	}
        		
        };

		self.saveBtn = function() {
			self.sendCommand("M500");
		
		};
		
		self.currentBtn = function() {
			
			if (self.selectedController().slice(0,4) == 'Tool') {
        			self.sendCommand("M301 E" + self.selectedController().slice(4,5));
        			
        	}else if (self.selectedController() == 'Bed') {
        			self.sendCommand("M304");
        			
        	}
		
		
		};

	
        
        
        self.fromCurrentData = function(data) {
        	//console.log(data);
        	self._processStateData(data.state);
        	self._processTempData(data.serverTime, data.temps);
        	self._processLogsData(data.logs);
        	
        	self.updatePlot();
        };
        
        self._processTempData = function (serverTime, data) {
        	var clientTime = Date.now();
        	
        	for (var i = 0; i < data.length; i++) {
        		var timeDiff = (serverTime - data[i].time) * 1000;
                var time = clientTime - timeDiff;
        		
        		var objActual = [time, parseFloat(data[i][self.selectedController().toLowerCase()].actual)];
        		var objTarget = [time, parseFloat(data[i][self.selectedController().toLowerCase()].target)];
        		
        		if(self.actTemp.length >= self.max_plot){
        			self.actTemp.shift();
        		}
        		
        		if(self.targetTemp.length >= self.max_plot){
        			self.targetTemp.shift();
        		}
        	
        		self.actTemp.push(objActual);
        		self.targetTemp.push(objTarget);
        	}
        	        	
        };
        
        self._processLogsData = function (data) {
        	//console.log(data);
        	
        	var rePid = /^Recv:\s+echo:\s+(?:e:\d+\s+)?p:(\d+\.?\d*)\s+i:(\d+\.?\d*)\s+d:(\d+\.?\d*).*/;
            var reToolPid = /^Recv:\s+echo:\s+M301\s+P(\d+\.?\d*)\s+I(\d+\.?\d*)\s+D(\d+\.?\d*).*/;
            var reBedlPid = /^Recv:\s+echo:\s+M304\s+P(\d+\.?\d*)\s+I(\d+\.?\d*)\s+D(\d+\.?\d*).*/;
            var reTuneStat = /^Recv:\s+bias:\s*(\d+\.?\d*)\s+d:\s*(\d+\.?\d*)\s+min:\s*(\d+\.?\d*)\s+max:\s*(\d+\.?\d*).*/;
            var reTuneParam = /^Recv:.+Ku:\s*(\d+\.?\d*)\s+Tu:\s*(\d+\.?\d*).*/;
            var reTuneComplete = /^Recv:\s+PID Autotune finished.*/;
            var reTuneFailed = /^Recv:\s+PID Autotune failed.*/;
            
            //from RC6
            //var commandMatch = command.match(re);
        	//Recv:\s+echo:\s+M301\s+P(\d+\.?\d*)\s+I(\d+\.?\d*)\s+D(\d+\.?\d*).*
            /*
            Recv: T:50.35 @:0
            Recv: T:50.14 @:0
            Recv:  bias: 20 d: 20 min: 49.53 max: 51.39
            ^Recv:\s+bias:\s*(\d+\.?\d*)\s+d:\s+(\d+\.?\d*)\s+min:\s+(\d+\.?\d*)\s+max:\s+(\d+\.?\d*).*
            Recv:  Ku: 27.42 Tu: 24.64
            ^Recv:\s+Ku:\s*(\d+\.?\d*)\s+Tu:\s+(\d+\.?\d*).*
            Recv:  Classic PID
            Recv:  Kp: 16.45
            Recv:  Ki: 1.34
            Recv:  Kd: 50.67
            Recv: PID Autotune finished! Put the last Kp, Ki and Kd constants from below into Configuration.h
            ^Recv:\s+PID Autotune finished|PID Autotune failed.*
            Recv: #define  DEFAULT_Kp 16.45
            Recv: #define  DEFAULT_Ki 1.34
            Recv: #define  DEFAULT_Kd 50.67

            Recv: echo:  M301 P29.20 I4.73 D45.33 C100.00 L20
            Recv: echo:  M304 P336.00 I61.00 D462.40

             */
            
          //from RC7
            //var commandMatch = command.match(re);
        	//Recv:\s+echo:\s+M301\s+P(\d+\.?\d*)\s+I(\d+\.?\d*)\s+D(\d+\.?\d*).*
            /*
            Recv:  T:200.4 /0.0 B:25.7 /0.0 T0:200.4 /0.0 T1:28.8 /0.0 @:0 B@:0 @0:0 @1:0
			Recv:  bias: 94 d: 94 min: 197.58 max: 202.73 Ku: 46.42 Tu: 21.82
			Recv:  Classic PID
			Recv:  Kp: 27.85 Ki: 2.55 Kd: 75.99
			Recv: PID Autotune finished! Put the last Kp, Ki and Kd constants from below into Configuration.h
			Recv: #define  DEFAULT_Kp 27.85
			Recv: #define  DEFAULT_Ki 2.55
			Recv: #define  DEFAULT_Kd 75.99
			Recv: ok

             */
            
     
            
            for (var i = 0; i < data.length; i++) {
            	
            	var logsMatch = data[i].match(reTuneStat);
            	
            	if (logsMatch != null) {
            		self.pidData.bias(logsMatch[1]);
            		self.pidData.min(logsMatch[3]);
            		self.pidData.max(logsMatch[4]);
            	}
            	
            	logsMatch = data[i].match(reTuneParam);
            	
            	if (logsMatch != null) {
            		self.pidData.ku(logsMatch[1]);
            		self.pidData.tu(logsMatch[2]);
            	}
            	
            	logsMatch = data[i].match(reTuneComplete);
            	if (logsMatch != null) {
            		self.pidAutoState("Completed");
            	}
            	
            	logsMatch = data[i].match(reTuneFailed);
            	if (logsMatch != null) {
            		self.pidAutoState("Failed");
            	}
            	
            	if (self.selectedController() == "Bed") {
            		logsMatch = data[i].match(reBedlPid);
                	
                	if (logsMatch != null) {
                		self.pidData.kp(logsMatch[1]);
                		self.pidData.ki(logsMatch[2]);
                		self.pidData.kd(logsMatch[3]);
                	}
            	}else{
            		logsMatch = data[i].match(reToolPid);
                	
                	if (logsMatch != null) {
                		self.pidData.kp(logsMatch[1]);
                		self.pidData.ki(logsMatch[2]);
                		self.pidData.kd(logsMatch[3]);
                	}
            		
            	}
            	
            	logsMatch = data[i].match(rePid);
            	if (logsMatch != null) {
            		self.pidData.kp(logsMatch[1]);
            		self.pidData.ki(logsMatch[2]);
            		self.pidData.kd(logsMatch[3]);
            	}
            	
            

        	}
            
        };
        
        self._processStateData = function (data) {
            self.isErrorOrClosed(data.flags.closedOrError);
            self.isOperational(data.flags.operational);
            self.isPaused(data.flags.paused);
            self.isPrinting(data.flags.printing);
            self.isError(data.flags.error);
            self.isReady(data.flags.ready);
            self.isLoading(data.flags.loading);
        };
        
        self.pidPlotOptions = {
                yaxis: {
                    min: 0,
                    max: 400,
                    ticks: 8
                },
                xaxis: {
                    mode: "time",
                    minTickSize: [1, "minute"],
                    tickFormatter: function(val, axis) {
                        if (val == undefined || val == 0)
                            return ""; // we don't want to display the minutes since the epoch if not connected yet ;)

                        // current time in milliseconds in UTC
                        var timestampUtc = Date.now();

                        // calculate difference in milliseconds
                        var diff = timestampUtc - val;

                        // convert to minutes
                        var diffInMins = Math.round(diff / (60 * 1000));
                        if (diffInMins == 0)
                            return gettext("just now");
                        else
                            return "- " + diffInMins + " " + gettext("min");
                    }
                },
                legend: {
                    position: "sw",
                    noColumns: 2,
                    backgroundOpacity: 0
                }
            };


        self.updatePlot = function() {
        	var data = [];
        	
        	var actualTemp = self.actTemp && self.actTemp.length ? formatTemperature(self.actTemp[self.actTemp.length - 1][1]) : "-";
            self.currentTargetTemp = self.targetTemp && self.targetTemp.length ? formatTemperature(self.targetTemp[self.targetTemp.length - 1][1]) : "-";

            data.push({
                label: gettext("Actual") +  ": " + actualTemp,
                color: "red",
                data: self.actTemp
            });
            data.push({
                label: gettext("Target") + ": " + self.currentTargetTemp,
                color: pusher.color("red").tint(0.5).html(),
                data: self.targetTemp
            });
        	

    		$.plot("#pidtune-graph", data, self.pidPlotOptions);

    		
           
        };
        
        self.sendCommand = function(command) {
          

            if (command) {
                $.ajax({
                    url: API_BASEURL + "printer/command",
                    type: "POST",
                    dataType: "json",
                    contentType: "application/json; charset=UTF-8",
                    data: JSON.stringify({"command": command})
                });

            }
        };




        self.onAfterTabChange = function(current, previous) {
        	if (current != "#tab_plugin_pidtune") {
                return;
            }
            self.updatePlot();
        };

    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        PidtuneViewModel,

        // e.g. loginStateViewModel, settingsViewModel, ...
        ["loginStateViewModel", "settingsViewModel"],

        // e.g. #settings_plugin_pidtune, #tab_plugin_pidtune, ...
        "#tab_plugin_pidtune"
    ]);
});
