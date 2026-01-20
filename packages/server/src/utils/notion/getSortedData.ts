import dayjs from "dayjs";
import type { DataSource } from "@codeblock-bff/shared";
import getDataSource from "./getDataSource";

const localCache = new Map<string, DataSource[]>();

export const getSortedData = async (): Promise<DataSource[]> => {
  const now = dayjs().format("YYYY-MM-DD HH:mm").slice(0, -1);
  const cachedData = localCache.get(now);
  if (cachedData) {
    return cachedData;
  }

  const parsedData = await getDataSource();

  const sortedData: DataSource[] = parsedData
    .filter((item) => item.url)
    .sort((a, b) => {
      const aGroup = a.group;
      const bGroup = b.group;
      if (aGroup !== bGroup) {
        return aGroup.localeCompare(bGroup);
      }
      return a.key.localeCompare(b.key);
    })
    .map((item) => ({
      title: `${item.group} • ${item.key} ${item.description ? `(${item.description})` : ""}`,
      description: item.description,
      url: item.url,
    }));

  localCache.clear();
  localCache.set(now, sortedData);

  return sortedData;
};

export const resetCache = () => {
  localCache.clear();
};

export default getSortedData;
