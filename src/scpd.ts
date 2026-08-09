import type { HttpClient } from "./device.js";
import { defaultHttpClient } from "./device.js";
import type { Service, ServiceSchema, StateVariable } from "./types.js";
import { asArray, record, text, xmlParser } from "./xml.js";

export async function inspectService(
  service: Service,
  client: HttpClient = defaultHttpClient,
): Promise<ServiceSchema> {
  const response = await client.fetch(service.scpdUrl, {
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error(`SCPD failed: HTTP ${response.status}`);
  const scpd = record(record(xmlParser.parse(await response.text())).scpd);
  const actionList = record(scpd.actionList);
  const actions = asArray(actionList.action)
    .map((raw) => {
      const action = record(raw);
      const argumentList = record(action.argumentList);
      return {
        name: text(action.name),
        arguments: asArray(argumentList.argument).map((rawArgument) => {
          const argument = record(rawArgument);
          const rawDirection = text(argument.direction);
          const direction: "in" | "out" =
            rawDirection === "in" || rawDirection === "out"
              ? rawDirection
              : (() => {
                  throw new Error(`Invalid SCPD direction: ${rawDirection}`);
                })();
          return {
            name: text(argument.name),
            direction,
            relatedStateVariable: text(argument.relatedStateVariable),
          };
        }),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const table = record(scpd.serviceStateTable);
  const stateVariables: StateVariable[] = asArray(table.stateVariable)
    .map((raw) => {
      const variable = record(raw);
      const range = record(variable.allowedValueRange);
      const result: StateVariable = {
        name: text(variable.name),
        dataType: text(variable.dataType),
        allowedValues: asArray(
          record(variable.allowedValueList).allowedValue,
        ).map(text),
      };
      const minimum = Number(range.minimum);
      const maximum = Number(range.maximum);
      const step = Number(range.step);
      if (Number.isFinite(minimum)) result.minimum = minimum;
      if (Number.isFinite(maximum)) result.maximum = maximum;
      if (Number.isFinite(step)) result.step = step;
      return result;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { actions, stateVariables };
}

export function validateInputs(
  schema: ServiceSchema,
  actionName: string,
  values: Record<string, string>,
): Record<string, string> {
  const action = schema.actions.find(
    (candidate) => candidate.name === actionName,
  );
  if (!action) throw new Error(`Action not supported: ${actionName}`);
  const expected = action.arguments.filter(
    (argument) => argument.direction === "in",
  );
  const expectedNames = new Set(expected.map((argument) => argument.name));
  for (const name of Object.keys(values)) {
    if (!expectedNames.has(name))
      throw new Error(`Unexpected argument for ${actionName}: ${name}`);
  }
  for (const argument of expected) {
    const value = values[argument.name];
    if (value === undefined)
      throw new Error(`Missing argument for ${actionName}: ${argument.name}`);
    const variable = schema.stateVariables.find(
      (candidate) => candidate.name === argument.relatedStateVariable,
    );
    if (!variable) continue;
    if (
      variable.allowedValues.length > 0 &&
      !variable.allowedValues.includes(value)
    ) {
      throw new Error(
        `${argument.name} must be one of: ${variable.allowedValues.join(", ")}`,
      );
    }
    if (
      variable.dataType.startsWith("ui") ||
      variable.dataType.startsWith("i")
    ) {
      const number = Number(value);
      if (!Number.isInteger(number))
        throw new Error(`${argument.name} must be an integer`);
      if (variable.minimum !== undefined && number < variable.minimum) {
        throw new Error(`${argument.name} must be >= ${variable.minimum}`);
      }
      if (variable.maximum !== undefined && number > variable.maximum) {
        throw new Error(`${argument.name} must be <= ${variable.maximum}`);
      }
    }
  }
  return Object.fromEntries(
    expected.map((argument) => [argument.name, values[argument.name] ?? ""]),
  );
}
