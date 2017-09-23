import { Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';
import BleManager from 'react-native-ble-manager';
import { log, LOG_INFO, LOG_INFO2, LOG_WARN, LOG_ERR } from './log.js';
import { observable } from 'mobx';

const config = {
	scanTime: 5000,
	rescanTime: 500,
	reconnectTime: 500,
	waitTime: 500,
}

let deviceInfo = {
	name: '',
	rssi: -128,
	id: '',
	serviceUUID: '00001234-0000-1000-8000-00805F9B34FB',
	characteristicUUID: '00001235-0000-1000-8000-00805F9B34FB'
}

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

String.prototype.getBytes = function () {
  let bytes = [];
  for (let i = 0; i < this.length; i++)
    bytes.push(this.charCodeAt(i));
  return bytes;
};

class Device {

	@observable isActive = false;

	constructor() {
	    if (Platform.OS === 'android' && Platform.Version >= 23) {
	        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
	            if (result) {
	              log(LOG_INFO, 'BlueTooth permission granted, proceeding...');
	            } else {
	              PermissionsAndroid.requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
	                if (result) {
	                  log(LOG_INFO, 'BlueTooth permission granted by user, proceeding...');
	                } else {
	                  log(LOG_ERR, 'BlueTooth permission denied by user!');
	                }
	              });
	            }
	      });
	      this.handlerDiscovered = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoveredDevice);
	    }

	    BleManager.start({showAlert: true})				//iOS specific
	      .then(() => {
	          log(LOG_INFO, 'Ble module initialized...');
	      });
	    this.FSMState = 0;
	}

	process(args) {
		switch (this.FSMState) {
			case 0: log(LOG_INFO2, '[STATE: SCAN]');
					this.scanState(args);
					break;
			case 1: log(LOG_INFO2, '[STATE: CONNECT]');
					this.connectState(args);
					break;
			case 2: log(LOG_INFO2, '[STATE: RESCANWAIT]');
					this.rescanWaitState(args);
					break;
			case 3: log(LOG_INFO2, '[STATE: IDLE]');
					this.idleState(args);
					break;
			case 4: log(LOG_INFO2, '[STATE: WAITFAILEDCMD]');
					this.waitState(args);
					break;
			default: log(LOG_INFO2, '[STATE: UNKNOWN (' + this.FSMState + ')]');
		}
	}

	scanState(args) {
		this.isActive = false;
		BleManager.enableBluetooth()
		.then(() => {
			BleManager.scan([deviceInfo.serviceUUID], config.scanTime, true)
		    .then(() => {
		        log(LOG_INFO, 'Scan started');
				setTimeout(() => {
					this.FSMState = 1;
					BleManager.stopScan()
					.then(() => {
						log(LOG_INFO, 'Scan stopped');
					  	log(LOG_INFO, 'Using device: ' + deviceInfo.name + ' rssi: ' + deviceInfo.rssi + ' id: ' + deviceInfo.id);
						this.process(args);
					});
				}, config.scanTime);
			})
		    .catch(() => {
		    	log(LOG_ERR, 'Scan error');
		      	setTimeout(() => {
		      		this.FSMState = 2;
		      	  	this.process(args);
		      	}, config.scanTime);
		    });
		})
		.catch(() => {
			this.FSMState = 2;
			log(LOG_WARN, 'User refuse to activate BlueTooth');
			this.process();
		});
	}

	handleDiscoveredDevice(device){
	    log(LOG_INFO, 'Found BLE device: ' + device.name + ' rssi: ' + device.rssi + ' id: ' + device.id);
	    if (device.rssi > deviceInfo.rssi) {
	    	deviceInfo.name = device.name;
	    	deviceInfo.rssi = device.rssi;
	    	deviceInfo.id   = device.id;
	    }
	}

	connectState(args) {
		this.isActive = false;
		BleManager.enableBluetooth()
		.then(() => {
			BleManager.disconnect(deviceInfo.id)
				.then(() => {})
				.catch(() => {});

		    BleManager.connect(deviceInfo.id)
		    	.then(() => {
		        	log(LOG_INFO, 'Connected');
		          	this.FSMState = 3;

		          	BleManager.retrieveServices(deviceInfo.id)
		  		    	.then((peripheralData) => {
			            	log(LOG_INFO, 'Retrieved peripheral services')
					      	this.process(args);
			          	})
			           	.catch((error) => {
			           		log(LOG_WARN, 'Can\'t retrieve services: ' + error); 
			           		this.FSMState = 0;
					      	this.process(args);
			          	});

	              	BleManager.readRSSI(deviceInfo.id)
		            	.then((rssi) => {
		                	log(LOG_INFO, 'RSSI: ' + rssi);
			    		  	this.process(args);
		              	})
		            	.catch((error) => {
		            		log(LOG_ERR, 'Can\'t read RSSI value: ' + error);
		            		this.FSMState = 0;
			      			this.process(args);
		            	});
	          })
		      .catch((error) => {
		          log(LOG_ERR, 'Error connecting: ' + error);
		          this.FSMState = 2;
			      this.process(args);
		      });			
		})
		.catch(() => {
			this.FSMState = 2;
			log(LOG_WARN, 'User refuse to activate BlueTooth');
			this.process(args);
		});
	}

	rescanWaitState(args) {
		this.isActive = false;
		log(LOG_WARN, 'Rescanning in ' + config.rescanTime + 'ms');
		setTimeout(() => {
		  this.FSMState = 0;
		  this.process(args);	
		}, config.rescanTime);
	}

	idleState(args) {
		BleManager.enableBluetooth()
		.then(() => {
				log(LOG_INFO, 'Sending cmd: ' + args.cmd);
				BleManager.writeWithoutResponse(deviceInfo.id,
								 deviceInfo.serviceUUID,
								 deviceInfo.characteristicUUID,
								 args.cmd.getBytes(),
								 16)
				.then(() => {
					this.isActive = true;
					args.callback();
				})
				.catch((error) => {
					log(LOG_ERR, 'Can\'t write to device! [' + error + ']');
					this.isActive = false;
					this.FSMState = 4;
					this.process(args);
				});
			})
		.catch(() => {
			log(LOG_WARN, 'User refuse to activate BlueTooth');
			this.isActive = false;
			this.FSMState = 4;
			this.process(args);
		});
	}

	waitState(args) {
		this.isActive = false;
		log(LOG_WARN, 'Rescanning in ' + config.waitTime + 'ms');
		setTimeout(() => { 
			this.FSMState = 0; 
			this.process(args);
		}, config.waitTime);
	}
}

export const dev = new Device();
