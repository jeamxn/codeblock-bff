import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Page } from "./types";
import { extractRichTextValue, extractSelectValue, extractTitleValue, extractUrlValue } from "./extracts";

const map = (page: Page) => {
  const typedPage = page as PageObjectResponse;
  const properties = typedPage.properties;

  return {
    group: extractSelectValue(properties.group),
    key: extractTitleValue(properties.key),
    description: extractRichTextValue(properties.description),
    url: extractUrlValue(properties.dev_docs_url),
  };
};

export default map;
