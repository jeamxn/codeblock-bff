import { client } from "./index";
import map from "./map";

const getDataSource = async () => {
  const response = await client.dataSources.query({
    data_source_id: process.env.NOTION_DATA_SOURCE_ID!,
  });

  const parsedData = response.results
    .filter((page): page is Parameters<typeof map>[0] => 'properties' in page)
    .map(map);

  return parsedData;
};

export default getDataSource;
