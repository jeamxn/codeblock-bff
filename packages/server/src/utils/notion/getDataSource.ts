import { client } from "./index";
import map from "./map";

const getDataSource = async () => {
  // Using databases.query instead of dataSources (dataSources is not a standard Notion API)
  const response = await client.databases.query({
    database_id: process.env.NOTION_DATA_SOURCE_ID!,
  });

  const parsedData = response.results
    .filter((page): page is Parameters<typeof map>[0] => 'properties' in page)
    .map(map);

  return parsedData;
};

export default getDataSource;
