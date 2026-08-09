export interface Device {
  host: string;
  location: string;
  roomName: string;
  modelName: string;
  modelNumber: string;
  serialNumber: string;
  softwareVersion: string;
  services: Service[];
}

export interface Service {
  serviceType: string;
  serviceId: string;
  controlUrl: string;
  eventSubUrl: string;
  scpdUrl: string;
}

export interface ActionArgument {
  name: string;
  direction: "in" | "out";
  relatedStateVariable: string;
}

export interface ServiceAction {
  name: string;
  arguments: ActionArgument[];
}

export interface StateVariable {
  name: string;
  dataType: string;
  allowedValues: string[];
  minimum?: number;
  maximum?: number;
  step?: number;
}

export interface ServiceSchema {
  actions: ServiceAction[];
  stateVariables: StateVariable[];
}

export type Scalar = string | number | boolean;

export interface SettingResult {
  setting: string;
  value: Scalar;
  supported: boolean;
  source: string;
  error?: string;
}
