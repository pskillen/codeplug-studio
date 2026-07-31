export {
  assertRadioSerialSupported,
  assertWebSerialSupported,
  getRadioSerialUnsupportedMessage,
  getWebSerialUnsupportedMessage,
  isCapacitorSerialSupported,
  isRadioSerialSupported,
  isWebSerialSupported,
} from './featureDetect.ts';
export {
  openWebSerialPipe,
  requestWebSerialPipe,
  requestWebSerialPort,
  WEB_SERIAL_HOST_BUFFER_SIZE,
  type SerialPortLike,
  type WebSerialPipeOptions,
} from './webSerialPipe.ts';
export {
  CapacitorSerialBytePipe,
  openCapacitorSerialPipe,
  requestCapacitorSerialPipe,
  requestCapacitorSerialPort,
  type CapacitorSerialPipeOptions,
  type UsbDeviceLike,
  type UsbSerialPluginLike,
} from './capacitorSerialPipe.ts';
