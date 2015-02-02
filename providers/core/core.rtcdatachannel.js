/*jslint indent:2,sloppy:true, node:true */

var util = require('../../src/util');

var unAttachedChannels = {};
var allocateChannel = function (dataChannel) {
  var id = util.getId();
  unAttachedChannels[id] = dataChannel;
  return id;
};

var blobToArrayBufferViaBinaryString = function(blob, callback) {
  var fileReader = new FileReader();
  fileReader.onload = function() {
    var result = fileReader.result;
    // Convert the string to an ArrayBuffer.
    var buffer = new ArrayBuffer(result.length);
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < result.length; ++i) {
      bytes[i] = result.charCodeAt(i);
    }
    callback(buffer);
  };
  fileReader.readAsBinaryString(blob);
};

var myBlobToArrayBuffer;

var blobToArrayBuffer = function(blob, callback) {
  var fileReader = new FileReader();
  fileReader.onload = function() {
    if (fileReader.result.byteLength) {
      callback(fileReader.result);
    } else {
      // Workaround FileReader.readAsArrayString strangeness in Firefox add-ons:
      //  https://bugzilla.mozilla.org/show_bug.cgi?id=1122687
      myBlobToArrayBuffer = blobToArrayBufferViaBinaryString;
      blobToArrayBufferViaBinaryString(blob, callback);
    }
  };
  fileReader.readAsArrayBuffer(blob);
};

myBlobToArrayBuffer = blobToArrayBuffer;

var RTCDataChannelAdapter = function (cap, dispatchEvents, id) {
  this.dispatchEvent = dispatchEvents;
  if (!unAttachedChannels[id]) {
    console.warn('Invalid ID, creating acting on unattached DataChannel');
    var Connection = require('./core.rtcpeerconnection').provider,
      provider = new Connection();
    id = provider.createDataChannel();
    provider.close();
  }

  this.channel = unAttachedChannels[id];
  delete unAttachedChannels[id];

  this.events = [
    'onopen',
    'onerror',
    'onclose',
    'onmessage'
  ];
  this.manageEvents(true);
};

// Attach or detach listeners for events against the connection.
RTCDataChannelAdapter.prototype.manageEvents = function (attach) {
  this.events.forEach(function (event) {
    if (attach) {
      this[event] = this[event].bind(this);
      this.channel[event] = this[event];
    } else {
      delete this.channel[event];
    }
  }.bind(this));
};

RTCDataChannelAdapter.prototype.getLabel = function (callback) {
  callback(this.channel.label);
};

RTCDataChannelAdapter.prototype.getOrdered = function (callback) {
  callback(this.channel.ordered);
};

RTCDataChannelAdapter.prototype.getMaxPacketLifeTime = function (callback) {
  callback(this.channel.maxPacketLifeTime);
};

RTCDataChannelAdapter.prototype.getMaxRetransmits = function (callback) {
  callback(this.channel.maxRetransmits);
};

RTCDataChannelAdapter.prototype.getProtocol = function (callback) {
  callback(this.channel.protocol);
};

RTCDataChannelAdapter.prototype.getNegotiated = function (callback) {
  callback(this.channel.negotiated);
};

RTCDataChannelAdapter.prototype.getId = function (callback) {
  callback(this.channel.id);
};

RTCDataChannelAdapter.prototype.getReadyState = function (callback) {
  callback(this.channel.readyState);
};

RTCDataChannelAdapter.prototype.getBufferedAmount = function (callback) {
  callback(this.channel.bufferedAmount);
};

RTCDataChannelAdapter.prototype.getBinaryType = function (callback) {
  callback(this.channel.binaryType);
};
RTCDataChannelAdapter.prototype.setBinaryType = function (binaryType, callback) {
  this.channel.binaryType = binaryType;
  callback();
};

RTCDataChannelAdapter.prototype.send = function (text, callback) {
  this.channel.send(text);
  callback();
};

RTCDataChannelAdapter.prototype.sendBuffer = function (buffer, callback) {
  this.channel.send(buffer);
  callback();
};

RTCDataChannelAdapter.prototype.close = function (callback) {
  if (!this.channel) {
    return callback();
  }
  this.manageEvents(false);
  this.channel.close();
  callback();
};

RTCDataChannelAdapter.prototype.onopen = function (event) {
  this.dispatchEvent('onopen', event.message);
};

RTCDataChannelAdapter.prototype.onerror = function (event) {
  this.dispatchEvent('onerror', {
    errcode: event.type,
    message: event.message
  });
};

RTCDataChannelAdapter.prototype.onclose = function (event) {
  this.dispatchEvent('onclose', event.message);
};

RTCDataChannelAdapter.prototype.onmessage = function (event) {
  if (typeof event.data === 'string') {
    this.dispatchEvent('onmessage', {text: event.data});
  } else if (event.data instanceof ArrayBuffer) {
    this.dispatchEvent('onmessage', {buffer: event.data});
  } else if (event.data instanceof Blob) {
    // Workaround for setBinaryType strangeness in Firefox add-ons:
    //   https://bugzilla.mozilla.org/show_bug.cgi?id=1122682
    myBlobToArrayBuffer(event.data, function(buffer) {
      this.dispatchEvent('onmessage', {buffer: buffer});
    }.bind(this));
  }
};

exports.name = "core.rtcdatachannel";
exports.provider = RTCDataChannelAdapter;
exports.allocate = allocateChannel;
