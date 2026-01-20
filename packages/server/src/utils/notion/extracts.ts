import type { ExtractPropertyType, NotionPropertyValue } from "./types";

export const extractTitleValue = (prop: NotionPropertyValue | undefined): string => {
  if (prop === undefined) {
    return "";
  }
  if (prop.type === "title") {
    const titleProp = prop as ExtractPropertyType<"title">;
    const firstTitle = titleProp.title[0];
    if (firstTitle !== undefined) {
      return firstTitle.plain_text;
    }
  }
  return "";
};

export const extractSelectValue = (prop: NotionPropertyValue | undefined): string => {
  if (prop === undefined) {
    return "";
  }
  if (prop.type === "select") {
    const selectProp = prop as ExtractPropertyType<"select">;
    if (selectProp.select !== null) {
      return selectProp.select.name;
    }
  }
  return "";
};

export const extractRichTextValue = (prop: NotionPropertyValue | undefined): string => {
  if (prop === undefined) {
    return "";
  }
  if (prop.type === "rich_text") {
    const richTextProp = prop as ExtractPropertyType<"rich_text">;
    const firstRichText = richTextProp.rich_text[0];
    if (firstRichText !== undefined) {
      return firstRichText.plain_text;
    }
  }
  return "";
};

export const extractUrlValue = (prop: NotionPropertyValue | undefined): string => {
  if (prop === undefined) {
    return "";
  }
  if (prop.type === "url") {
    const urlProp = prop as ExtractPropertyType<"url">;
    if (urlProp.url !== null) {
      return urlProp.url;
    }
  }
  return "";
};
