import React, { Suspense } from "react";
import Avatar from "./Avatar";

export default function Model({url}) {
  if (url === undefined) {
    url = "../models/AnimeGirl.vrm";
  }

  return (
    <>
        <Suspense fallback={null}>
            <Avatar url={url} />
        </Suspense>
    </>
  );
}
