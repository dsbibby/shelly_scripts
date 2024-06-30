let config = {
  thresh_upper: 65,
  thresh_lower: 40,
  polling_freq: 30, // how often to update temps in seconds
  thermostat_switch_id: 0,
  auto_immersion: false,
  auto_immersion_period: 1800 // turn the immersion on if temps arn't rising after x secs
}

let _ = {
  pId: "Id" + Shelly.getCurrentScriptId() + ": ",
  disable_hot_water: false,
  below_thresh_count: 0
}

/*******************************
       Helper Functions
********************************/
String.prototype.startsWith = function(searchString) {
  let l = searchString.length
  return this.substr(0, l) == searchString
} 

function log(msg) {
  print(_.pId, msg)
}

/*******************************
             Start
********************************/
function start() {
  log("Start")
  /* Respond to press of disable hot water button */
  Shelly.addStatusHandler(function(dat, ud) {
    if (dat.component == "input:" + config.thermostat_switch_id) {
      _.disable_hot_water = dat.delta.state
    }
  })

  configuration()
  Timer.set(config.polling_freq * 1000, true, getAllTemps, updateAverageTemps)
}

function configuration() {
  config.immersion_switch_id = 1 - config.thermostat_switch_id
  
  Shelly.call("Script.SetConfig", {
    id: Shelly.getCurrentScriptId(),
    config: {
      name: "Hot Water Controller",
      enable: true
    }
  })
  
  Shelly.call("Input.SetConfig", {
    id: config.thermostat_switch_id,
    config: {
      name: "Disable Hot Water"
    }
  }, function() {
    Shelly.call("Switch.SetConfig", {
      id: config.thermostat_switch_id,
      config: {
        name: "Hot Water Demand",
        in_mode: "detached",
        initial_state: "off"
      }
    })
  })
  
  Shelly.call("Input.SetConfig", {
    id: config.immersion_switch_id,
    config: {
      name: "Immersion Heater",
      type: "button"
    }
  }, function() {
    Shelly.call("Switch.SetConfig", {
      id: config.immersion_switch_id,
      config: {
        name: "Immersion Heater",
        in_mode: "momentary",
        initial_state: "off"
      }
    })
  })
  
  Shelly.call("Switch.Set", {id: config.thermostat_switch_id, on: false})
  Shelly.call("Switch.Set", {id: config.immersion_switch_id, on: false})
  // Shelly.call("Virtual.Add", {type: "boolean"})
}


function getAllTemps(callback) {
  Shelly.call("Shelly.GetStatus", {}, processGetStatusResult, {
    callback: callback
  })
} 


function processGetStatusResult(res, err, msg, data) {
  let temps = [] 
  for(let k in res) {
    if(k.startsWith("temperature:")) {
      temps.push(res[k])
    }
  }
  data.callback(temps)
} 

function updateAverageTemps(temps) {
  let sum = 0
  for(t in temps) {
    log(temps[t])
    sum += temps[t].tC
  } 
  let average = sum / temps.length;
  
  log("Average Temp: " + average)

  if (average > config.thresh_upper) {
    // We're above the threshold so turn the stat relay off
    Shelly.call("Switch.Set", {id: config.thermostat_switch_id, on: false})
    Shelly.call("Switch.Set", {id: config.immersion_switch_id, on: false})
    
  } else if (average < config.thresh_lower) {
    // We're below the threshold, so turn the stat relay on
    Shelly.call("Switch.Set", {id: config.thermostat_switch_id, on: _.disable_hot_water})
    
    // If things arn't warming after a while, turn on the immersion
    _.below_thresh_count += 1
    let below_thresh_duration = (_.below_thresh_count * config.polling_freq)
    log("Below Threshold Duration: " + below_thresh_duration + "s")

    if (below_thresh_duration > config.auto_immersion_period) {
      Shelly.call("Switch.Set", {id: config.immersion_switch_id, on: config.auto_immersion})
    }
    
  } else {
    _.below_thresh_count = 0
  }
}

start()
