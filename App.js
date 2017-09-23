import React from 'react';
import { Animated, StyleSheet, Text, View, Image, TouchableWithoutFeedback } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import BleManager from 'react-native-ble-manager';
import { dev, Device } from './device.js';
import { log, LOG_INFO, LOG_WARN } from './log.js';
import { observer } from 'mobx-react/native';
import * as Progress from 'react-native-progress';

const maxRadius = 60;
const minRadius = 10;

@observer
export default class App extends React.Component {

  state = {
    timerID: -1,
    time: 0,
    radius: minRadius,
    mokaActive: false,
    cmdReady: false,
  }

  inflate() {
    this.state.timerID = setInterval( () => { 
                    this.setState( prv => { 
                                      if (prv.radius >= maxRadius) {
                                          clearInterval(prv.timerID);
                                          return { cmdReady : true };
                                      } else
                                      return { 
                                          time: prv.time + 1, radius: Math.min(prv.radius + 1, maxRadius), cmdReady: false
                                      };
                                   } ); 
                  }, 5 );
  }

  deflate() {
    this.state.timerID = setInterval( () => { 
                    this.setState( prv => { 
                                      if (prv.radius <= minRadius) {
                                          clearInterval(prv.timerID);
                                          return { cmdReady : true };
                                      } else
                                      return { 
                                          time: prv.time + 1, radius: Math.max(prv.radius - 1, minRadius), cmdReady: false
                                      };
                                   } ); 
                  }, 5 );
  }

  exec() {
    if (this.state.cmdReady) {
      this.state.cmdReady = false;
      this.state.mokaActive = !this.state.mokaActive;
      if (this.state.mokaActive == true)
        dev.process({cmd: 'mokaon', callback: () => { this.inflate(); }});
      else
        dev.process({cmd: 'mokaoff', callback: () => { this.deflate(); }});
    }
  }

  componentDidMount() {
    dev.process({cmd: 'mokaoff', callback: () => { }});
    this.state.cmdReady = true;
  }

  render() {
    let controlWidget;
    if (dev.isActive)
        controlWidget = <TouchableWithoutFeedback onPress={() => {this.exec();}}>
                          <Svg height='150' width='150'>
                            <Circle cx='75' cy='75' r={this.state.radius} stroke='black' fill='black'/>
                          </Svg>
                        </TouchableWithoutFeedback>;
    else
        controlWidget = <Progress.CircleSnail size={maxRadius} indeterminate={true} color={'black'}/>;

    return (
        <View style={{flex:1}}>
            <Image style={styles.bkgImage} source={require('./images/background.jpg')}/>
            <View style={{flex:1, justifyContent: 'center', alignItems: 'center'}}>
              <Image style={styles.logo} source={require('./images/mokase.png')}/>
            </View>
            <View style={{flex:1, borderRadius: 100, justifyContent: 'center', alignItems: 'center'}}>
            </View>
            <View style={{flex:3, justifyContent: 'center', alignItems: 'center'}}>
              <Image style={styles.tazzina} source={require('./images/tazzina.png')}/>
              {controlWidget}
            </View>
            <View style={{flex:1}}/>
        </View>

    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bkgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    position: 'absolute',
  },
  logo: {
    width: '60%',
    resizeMode: 'contain',
  },
  tazzina: {
    width: '60%',
    resizeMode: 'contain',
    position: 'absolute'
  }
});
