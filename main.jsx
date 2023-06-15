import React, { useState, useMemo, useRef } from "react";
import "./styles.css";
import { useInfiniteScroll } from "./customHook";
import useSWRInfinite from "swr/infinite";
import axios from "axios";
const pageLimit = 10;
const pageStart = 0;
const fetcher = (url) => axios.get(url).then((res) => res.data);
const fectherFunc = async (x) => {
  return await fetcher(
    `https://api.instantwebtools.net/v1/passenger?page=${
      x + pageStart
    }&size=${pageLimit}`
  );
};
export default function App() {
  const [loading, setLoading] = useState(false);
  const observer = useRef(null);

  const { data, setSize, size } = useSWRInfinite(
    (index) => `fsd-${index}`,
    () => fectherFunc(size),
    { revalidateFirstPage: false }
  );

  const newData = useMemo(() => {
    setLoading(false);
    if (data) {
      return [].concat(...data.map((el) => el.data));
    }
    return [];
  }, [data]);
  console.log(newData);

  const isEnd = newData.length === 100;
  const { lastDataRendered } = useInfiniteScroll(
    setLoading,
    setSize,
    observer,
    { size, loading },
    isEnd
  );

  if (!newData.length) {
    return <div>lading...</div>;
  }

  return (
    <div className="App">
      <h1>Hello CodeSandbox</h1>
      <h2>Start editing to see some magic happen!</h2>
      <div onClick={() => setSize(size + 1)}>Load More</div>
      <div style={{ height: "200px", overflow: "scroll" }}>
        {newData.map((el) => (
          <p key={el?._id}>{el?._id}</p>
        ))}
        <div ref={lastDataRendered}>hello</div>
      </div>
    </div>
  );
}
