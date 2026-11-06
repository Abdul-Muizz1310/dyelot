// Built with Remotion (https://www.remotion.dev).
// Remotion is not open source: read its license at https://remotion.pro/license before you use this file.
// Companies of four or more people need a Remotion Company License.
// This root was exported by dyelot (MIT); the Remotion package it imports is under Remotion's license.
import { Composition, registerRoot } from "remotion";
import brand from "./brand.json";
import { BRAND_INTRO, BrandIntro } from "./brand-intro";

export function RemotionRoot(): React.JSX.Element {
  return (
    <>
      <Composition
        id="brand-intro-light"
        component={BrandIntro}
        {...BRAND_INTRO}
        defaultProps={brand.light}
      />
      <Composition
        id="brand-intro-dark"
        component={BrandIntro}
        {...BRAND_INTRO}
        defaultProps={brand.dark}
      />
    </>
  );
}

registerRoot(RemotionRoot);
