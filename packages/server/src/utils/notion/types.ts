import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export type Page = PageObjectResponse;

type PropertyValueMap = PageObjectResponse["properties"];
type PropertyValue = PropertyValueMap[string];

export type NotionPropertyValue = PropertyValue;

export type ExtractPropertyType<T extends PropertyValue["type"]> = Extract<
  PropertyValue,
  { type: T }
>;
