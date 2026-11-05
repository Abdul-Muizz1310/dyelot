---
version: "alpha"
name: "Default"
description: "A palette of neighboring hues of balanced intensity, with neutrals tinted toward the brand, built for AA contrast within the sRGB gamut, set in Young Serif for headings, Onest for text and Fragment Mono for code, with softly rounded corners, soft shadows and brisk motion."
colors:
  background: "#ffffff"
  foreground: "#242426"
  card: "#f9f8f9"
  card-foreground: "#242426"
  popover: "#f9f8f9"
  popover-foreground: "#242426"
  muted: "#eeeff1"
  muted-foreground: "#59585e"
  secondary: "#e7f0fb"
  secondary-foreground: "#24344e"
  accent: "#faeafe"
  accent-foreground: "#492651"
  primary: "#7969c7"
  primary-foreground: "#ffffff"
  destructive: "#c05550"
  destructive-foreground: "#ffffff"
  destructive-subtle: "#feebe8"
  destructive-subtle-foreground: "#5b211f"
  success: "#065123"
  success-foreground: "#ffffff"
  success-subtle: "#e1f4e4"
  success-subtle-foreground: "#033d18"
  warning: "#d4812b"
  warning-foreground: "#000000"
  warning-subtle: "#feecdb"
  warning-subtle-foreground: "#542802"
  info: "#0b5b9c"
  info-foreground: "#ffffff"
  info-subtle: "#e3f1fe"
  info-subtle-foreground: "#08355d"
  border: "#dfe0e3"
  input: "#76767d"
  ring: "#7969c7"
  sidebar: "#f9f8f9"
  sidebar-foreground: "#242426"
  sidebar-primary: "#7969c7"
  sidebar-primary-foreground: "#ffffff"
  sidebar-accent: "#eeeff1"
  sidebar-accent-foreground: "#333436"
  sidebar-border: "#dfe0e3"
  sidebar-ring: "#7969c7"
  chart-1: "#7969c7"
  chart-2: "#59231a"
  chart-3: "#c05647"
  chart-4: "#18467d"
  chart-5: "#963a46"
typography:
  caption:
    fontFamily: "Onest"
    fontSize: "10.24px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0.0087em"
  label:
    fontFamily: "Onest"
    fontSize: "12.8px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "-0.0025em"
  body-sm:
    fontFamily: "Onest"
    fontSize: "12.8px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.0025em"
  body:
    fontFamily: "Onest"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "-0.011em"
  lead:
    fontFamily: "Onest"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: "32px"
    letterSpacing: "-0.0167em"
  h4:
    fontFamily: "Young Serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: "28px"
    letterSpacing: "-0.0167em"
  h3:
    fontFamily: "Young Serif"
    fontSize: "25px"
    fontWeight: 400
    lineHeight: "32px"
    letterSpacing: "-0.0199em"
  h2:
    fontFamily: "Young Serif"
    fontSize: "31.25px"
    fontWeight: 400
    lineHeight: "40px"
    letterSpacing: "-0.0215em"
  h1:
    fontFamily: "Young Serif"
    fontSize: "39.0625px"
    fontWeight: 400
    lineHeight: "48px"
    letterSpacing: "-0.0221em"
  display:
    fontFamily: "Young Serif"
    fontSize: "48.8281px"
    fontWeight: 400
    lineHeight: "52px"
    letterSpacing: "-0.0223em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "24px"
  full: "9999px"
spacing:
  "0": "0px"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
  "20": "80px"
  "24": "96px"
  "32": "128px"
components:
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
  popover:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.popover-foreground}"
    rounded: "{rounded.md}"
  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.sidebar-foreground}"
  muted-panel:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
  muted-text:
    backgroundColor: "{colors.background}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.body-sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "40px"
  menu-item-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  sidebar-item-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "{colors.sidebar-accent-foreground}"
  sidebar-button-primary:
    backgroundColor: "{colors.sidebar-primary}"
    textColor: "{colors.sidebar-primary-foreground}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
  alert-destructive:
    backgroundColor: "{colors.destructive-subtle}"
    textColor: "{colors.destructive-subtle-foreground}"
  badge-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.success-foreground}"
  alert-success:
    backgroundColor: "{colors.success-subtle}"
    textColor: "{colors.success-subtle-foreground}"
  badge-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.warning-foreground}"
  alert-warning:
    backgroundColor: "{colors.warning-subtle}"
    textColor: "{colors.warning-subtle-foreground}"
  badge-info:
    backgroundColor: "{colors.info}"
    textColor: "{colors.info-foreground}"
  alert-info:
    backgroundColor: "{colors.info-subtle}"
    textColor: "{colors.info-subtle-foreground}"
  divider:
    backgroundColor: "{colors.border}"
  input-outline:
    backgroundColor: "{colors.input}"
  focus-ring:
    backgroundColor: "{colors.ring}"
  sidebar-divider:
    backgroundColor: "{colors.sidebar-border}"
  sidebar-focus-ring:
    backgroundColor: "{colors.sidebar-ring}"
  chart-1:
    backgroundColor: "{colors.chart-1}"
  chart-2:
    backgroundColor: "{colors.chart-2}"
  chart-3:
    backgroundColor: "{colors.chart-3}"
  chart-4:
    backgroundColor: "{colors.chart-4}"
  chart-5:
    backgroundColor: "{colors.chart-5}"
---

# Default

## Overview

A palette of neighboring hues of balanced intensity, with neutrals tinted toward the brand, built for AA contrast within the sRGB gamut, set in Young Serif for headings, Onest for text and Fragment Mono for code, with softly rounded corners, soft shadows and brisk motion.

Style: Default. A balanced product palette with soft corners.

Made with dyelot. Edit this design: <https://dyelot.vercel.app/studio#s=rVzbjiM5cv0X-bW6nbyT_bbwGvCDDRiwYWMx2Ie8MKuEVklaSTUzvYP-9z3MCxnKDKUajZ3FYmpSqZNMknHixIX6Y9eeDqfL7ssfu3N9iLdbvKa_67aNx1v6q6svX3dffkn3HW-X-oqL4nNlghYvu7f4--7L7l9EK6zodi-709dD-5a-1O6-VJ8roaXHTbsvSoSX3SFdk6Iy0nx_2V1v8bz7YqrvL_fIwgiPmydkaUQn_RpZWrFC1trpgiyqFTTudQVaWalVs4bWzi6Rg1ROZ2S5RrZGVOlbI7JuZW_0Gtkptxy0MlZVBVotoeVnEUJwGdpa1Tq5ghaVEGYBrWVQNmRovYRWn6tK-wLtpW58v4ZOgHfABitYebKEC2CNO7AUGTj01tXxB4BtVVmXcfFf97gOA8ZkZdwm-rZtmblwaWdSYCeEUGWW3RI5fNbYzmkCR-TO1CGK9QL6IJez7IL0VRm0X-0NCWxTdl0Mreu5vSHSi1Fk76QLZdBhhWwwz15m5N5H2a-nudI6uGEAFDwoT3Z0gBn-FXd8xPme_esbHrE0elvpMkl919t-vV8qoYxevUzwQlZ2y-wxyrK0fR1r7l1UtTSgYIwyZTPyVp--NAGrzvX1GtgsbT4I6UwZMGvzVTGeaJqmX9tl5e1ywF5bYzYtHs_yhVs7Heq43jBr63EW_zyx90qWndj0rm0Ze18unfWAktvmDuIl5m66-gdwjVdWFb5mzd0O3xpxXa2VXy-dkMul085bXSaCsXbwUyiGYyul7dp7wVEtgUF8suwJztaBXDYbHgLHwGyK5VQopUDy26YuTJkKJUWjmF1s1dJzWS-dWtr5sX6Hoc8u_mV3jvXXf3u7nN7rcaFwf1cfX-MgCh65f1EmUES4f7vh_hNrZu9PPcfa-Y_kPTn_BsKCec3s_Auu1r5sUY4EwD5l62shpWCoa3b9BTdAI5SF4Vjgjt1NJxvpNjx_Rh4cf9n9LA0YX6zKRVjLluPPyPD70pUxczwgKoIcOm109ZBgMi7cPp72xO1T99xZYdb6aoULw3dEArE8YFSh2q71zjH8Mrv9DAyvr0SZYtbrV5Y4nao2gdkV2esX5IC1K_uNJwJHXHNsTcMgW5jRYl_A62uxTQXJnxPoqDipggFiOe6xg3J0QqjXH-7hnb7xA63Mj-tdb9aPq0KlJoYvj4MwcpvWroMnrjlGKDrG2oXXw3al0EZjOz7x-sTg-75zneK0EdZxJM2CLYSVxX3wap_qrtj4hnP9Qtsln8D5i_DE6vG1gm2D9oxrWtoQfL83hedZ32-JDUXEM5zLW6xgcv3iiesn4qrFnjMMkyxQ4fi1LxPM63xVYINTjVpvjNnxF-JzXosnfh-7olCqk1EyBDX5_YJbJb2wLfEHlz75gEYKzrlMXr94ALwj4Wne6etieqoXnvOyk9MvPgs-nzLInc-f_Drr8_fH_rTh8R0Jy4XGWDjtXzx-NQ8HGpi4UDbgH0xwQjZSMItCfX5G1gjqtklAEn8knGw1w5TF6WdgjJhIdJYBFFHSwqnWMNEK8foztNJO-CIh2XgfhFegvY5-PWjq9mdouI3KFmNlOUBpotp6q-otv5-BA3xZ2f8cC0hJYiEVfcV4uzUw9I0PhbVYIpBVmWfra9kxiYTi-WdkCxdZbVOBhGYsuY-m6eK265-hHSJZvR0EYEeRMEt0lgtlLXzjatzYeNo-i_lVGXdXx4aNk5GwUsuRB6UQ_z1w_-mmR0G_Iv5f9YEL-itE73ImuPxA5C_IZucEgPcFO4LhuJeRCna8NKQAbhQFm1cARSa1Aeic4odGHebzDht-TJZ9yap-ePcMXldt7Jn0p5cWNy6XWBlJ0josA1gy4040ul_T_tqaHEJE-0QDSBJdaSQW4zpWyd462xL-cXQVGRGgZOEViWxfyyQslrgGuLrwFWf98GNlvFVjmsCk-7IMyHwF9rYlUGGN3ysCHLRzXB5xaUAK8bx8IvuFK0RYYa0Nty-WUwFz9SR1w0sBVTgFO8toRnJmKZA9mU05uwdaYPD3rBI4xg88GQiPxIBFlo_4qPQ_hhNElXYFxpOUwyQGECdsZ_8Hwp09lAT_c8BD2voOGMqPpOt4OiAuG2E6fAkDPZNBQQZL62diQJXtr4Kq1Xo3IYaVy0FDDIRn0QDIj9QVdMvoa8TPcnZTGRtqwIViBHwWgKiBtFEsF9jNoVdBDsJ4KugYPqBW4DrXMBKGQQasepIRhAsryKELsWbMoHJ2CW1DQHloOxcAf1y8NsbccKsILbvEdl6BV59kA0g806lOdtxUm0kOZGRv4SsKMp8MGL41eVAfQ2TEM56-2iBBQT6vUoOjGhhuepANCISHoAV8HzgDXRo-pIAn889m_kyx_Bhj33N7ZvAzd8CD9twOAsrM97GKTBpgTpQUVGQLn-b9SIKnDfgfI10gyJdLCmFWZp3P_pNwqEYlpPkhs3RG2WI7rPcnE4ykpQ7MTlnuQOQVpKGEzRi7J7gOUsFxleClqVtniM1wpo6CXLFHExAscBM8qaDCTvYulc4aeiCZYIvkJ5NirlZWDl5Humhb91uSFEd4rxUTrg914jtgiYzttuZP1cniuiC0JQc81GDuXJdFVXqV75u8_-zjlwJgSPGeL_v3-vJtIxvgSSUd7t9tZwOoAPAkl8LzQHnVSkTJsHBJBhABANH3LCMoaG1BImLZyAYUZEgWX9KYPBcMwda08DViOMZLl2xAWXrEHsThsWygh9LktFs71Dk2swHFDqShWUy-GkgYzMLM6zU15jCjWC6451n13wmSZYtOtEzhYg0MTiK1KjYbQNKuIQbTbZUBCjPCCPyTOkAYpOrk-30jOOdTkgHE9Xsvypj5iIBMRif4SBFtHWO6-t77Y8M-SRBiSqj3d2wyANa5lJ7YsE6VVfxR7w-7Iwn7gFoAmwswoNUpFClP9KhJlKlipT_J9cQ-dhy4lOCPlbuGAifx04MmAFJT7ztIAcb4kXwcAsN7LYBmiSeNAKScBiGgOGxfBTQcLZdYI8R9kg7E5qVywPRMKnxlTA4FWaK3-GRAmZBgPaTjw5i9yAGHMsMzOUA6oRx2dfs4x1BsH6n7sF0SQNBBUuy6C0z5Yk4FFBYEx6sSsbMlgbH3YyJYZHIZ-ZJTAQUY4yGlNF7zB5K8t5JNEc-pgOISFDwkkeVsKsAVYDTI9VupACIGIPkeaIHZ3bPJgGvE06ECttRAIFUg9AJ4rhkQRjI1w8hUMZ-LA0h3b5cILekzbBAQM-V1KMWcICQZAbdNCTBlIjWkbBQTykiMeokMYiaJdpYRDHGtAG64NhANGbccNVICCPqexAeaNDF63Vkuuzy2O1DolBEw2xmBVOgqtuCxkIw0njvVCDIyAmVr8QmBYmOIoLua65FY4UJkQodvKwJNKmTQpD3DNqjx5xxhyQd4xPvPeoTKPNeqqTsmXgIbzlnCogmkkwX6gSYo89zKTnO1B4jn5YSgrwnE_iRUGELOyc91aKNjoNFG54fqBwVHecBS5rkrD2wlBIiq7jVEARumIcRZzRSSAqgwbwcDJG8CdVP1XMyK_oAlsoHYL8gPeoFpk10UPbNzMCVLZOwmt238WILCK41pm8iwYWqhXa6uQvD8pDJgCNEGhdoSEx2tDQm5AZQ5niQDiRxA_cq2DBmuNiQqA4FU8NjSILqQSRjvXP0jwCk_QGq7rCCAoyE1R1N7JrODHs4lWVktxLblQy8TZPRjWCa7nXPtJEGAyuC23UsSwCBi1ZqxldK2QzIEivQdsmYPAUXicYlkELObczmaZghInuteFRTHv8oRjFb7gQbC63Ba4FHLAMkVolwHN7GRJICxZ1WA4uV2pECr76jVceWHnCQgwMoH0sLGiwLSISLQoycYC5uTBAQZrRmkmYOlBUdLG_BJktuv8xoVaPSGWuJP-CMChCaFNF4yWj4nCQq0BpkRmmR5gaY2EIz0zMaaww8CDCd4F-yteQE9rMXGGt8yCmmNm4JW0kbO9wqSND5KkZ1jBjwnCQqyRZmHjJgtGlLCQXUATQYbSYICjT4jgD-LFUiM18VmQx8V4CSoAwni-cwh6c-KPVt4yCKmQKcWUkLsVAyMNz3qFaBiQPQNl0cRk-olT0MvxLbFQ4sV5oSv1kxLfD4dQIDROUgOfrAGDwIqM2RwPoOTeUt7x1zTVkq-RYBI0xA7VzMkNZ8PIIuKWhIpr7HmjgCk-OqqRVrsB2wHZIxiyaaxI7oqc6FNDbH5KHYnlgP-JckXPidAzgeICPHJZBqXuAZdls8kAKo0pIxvnWQSgiCiKTNO-AlZZnKmgZX_yMkVbLR8MnQNTkVZccnXcAXbTQIQFGWaoTE7zn1Nkojgoltmu0cA3aykq8GgfZ6xvkm3ENdlFA2FFhpg8vFsZuC3-nLcH1-32gRI8U10SVdtCABX_D8SeptZAeReSOjucQCBSYFkAWA9_HMqJs2VAgQt27EBHChxTkklPRYB1sItpd07CQH0IWy3C-CLZVbQsgNvtCEErAbPJ3c1VQyQAC1Tw7IDPYyDbnJUnNbwEOVjMh0PUFjN9L5T3QDHqYqHZbME6IcofrDHqQAuI4lYZdxpVgDUY66mXAEk2LYywHGA4rMw-Q2nZiZ6MwFt_oln5xKCJJPPHykiXWE4Wtob5kjRLA9SynEuIYDOnxwlINo-2rplSLmoA2PplkRrLY6bPTlEOCSPJ8_atJ4Lo2aJYDCLZUsii4IY-UkdgR6-6yMKTYx7NX52hEbSTYnNhDw2KxYGm354mJA0uve945IgQsFYxsXI9IBKAjzONj0QC8O5gpZL3cxq4Z4dsGtx8O-JYqAHCtuubh4rhntyQCkBaclnjYVFvvYKvp3LGk-q4Z4b0P1OY2Y-UCCnyLBJK8P0vU2mdc8LDlwetnlBwB2SjAr6ZJnm-nGD3nMCIidJVBrLCWBN0lKLuIzJ0qckx2Re97SA4xEk7GP7imiVDkdjYc0MLeCw6YIYUjs3Ua4PwgbSwtwigGEkeMBZkaHTa0kNmGhBNjt_-IAkKtEXCPNgqAHJtqEpa8kOKDhAAGzrCtSuijvsRFMxkeukK-6ZAQ2waEp9oC1m-cBoi9SCUF_q9yG50E6f7Jr6UB_bIZs2j-8_468RT9r96U-4-Fq_f2DEu-vlNe28t_ryfjqibLGrj_Xh9Hr6SDpm6nv43336dYNdc6mPCe_a4rcP_uuE7nJ8_YZr9aXbYRSX02H8PYRR4JTfRSA_TTBe-tSfLvH1cvoAHj3n3dTt13IZfhE7LV0-Xbp0wJK0IrbpmbSfMl1Yws4dXi3e7vZJ3FXYx2tyPJzdjmfux2sqe7vkNcZregg2ZeP6tJrjNTNcQ0VhaLvs4vV2-Whv-1_TtJQDfeT6YnjoKcA_i1uuH83tMCDkA53rjxdA-cTcg9cfz6qQIwHpwqPBDJ-VUeQjJuT64qu5aX9_PA9bqnQxYothB9Lu1OHKAiC3Jp5P59Ov40LndZ2uPVra3HxDlna69ugNL4MMJ_eToh0pm-WrC5xcgrjukXuo70c7XftUdn5-8_uPFqC5zXG-i9ny80cPZmL-mJuRxWePZma-bT1Dc_aS5HKmaw-xpo_vttKYe7z_aAGQMzo5YCK6ebq23P_DP-RjYkRzuHP_0RJglIigsEl-UerKP6_ALlw-tn5PXXlIZR1zP-VMXbkhlKGu3LdGqWvuDyDUZfBrKwNJEOrCyUIIgHvqQnZgbDUk1IWTE7VOz1hQVz6Z-Ji68uvx1JVPpz6lrnz-78Hrz9SVzzMw1JUHs6CufETmMXXlQweFuuaezExdub2Wo67cakmoK68rT1353aihzkvLG2h-w2yY8_131JVrfo-oK1dRCHXl0a6pK7_5JnXl3s01deUtz1NXngmOuvIbblJXnpkVdeXvF-rKiSmeugrWirpyEnWTunJ2ilBXlvY8dWW6XFNXDsU2qWuSsN-TCmxP7-fTESs0KkGwSnptaLd4qUcbPB0PqUAV389v9XWfPsX9n_r94YCdfcZWBfT-dEwGgR00wBz2kH3Dmhw-WkxymoTb5fQ1_jcUbkrdDaYzQH3cDvsjjCb9JEY83wa9e32ru9Nv-PiXX_76gqi2PuDRg3AFNx4-sE2grfOPaj1tzj31_TXe_oLPMIzzJdaYhEGDZ9zUUDUC45afAMa4CvCDISOg-QlkvOizIf8T5uLBkFOz9U9AY2TPxow_fgIYAdDzMf8cNFbn2Zj_CQv4YMwSiZef2XX42rNBp3t-Ahp3kFEjorzevg0Mcz31t2Sr7_GGJwESN8HD_f8-We4YNJ4OKQqMx1fY9f_FyzVxA87Ff4uH0-3zePlfk4OYgtQ_x77-OKRfybnGwXmmf0G8pIecbsOXERx-XOr098AuTX1NLTMVXq0fI-j05_6Ywkr8V8q7_-1j3yKaHHLw18PptyFZM_6ZvAxi_uk_0teHdMgugtyOr_mn-Q7gvxse8wsC-JfqRbwIzEIX6Qe4jA9weaLGv6fh4340vSGdg_-PX8rRbvpMTl_CA8HVKbBuLvvr1_T2cFbT8xsQdTt0Aw5_4WEpL_2y-3V__agPf57mYki8pMj__XQaeTPfzd06pH-O9fm8AMYuXN-MHxBMzuHyMQfnEFTgYvw7zfAvafgg6TMA_thd6m6_T3_I3_E-KYnafxzwF06BpA0Gj5Z45B3vn4zsfTCJdOdwuDh9-eP6P3HIKkx763qu09DGhU4eI9lQSh8Mk65f_AsAYed4FKofKL_iJ2Z89YK2AiF9Gtrt2ziytB3j7wn6fDl1kJRJM9bv-8N-fKvm1CUfBXeGbYCX21_Phzpd-YbZge-Ml31y7chxJD3ZX-rX9yRlhv-eUi7JSSV_d4z_EVMYkIabKGja3G19HqY0aY2_D-8iUn0EQ4R3_Yr1_nfMx9C6iT6tVO7cwDrUDTYMQUIi6B7o03CAC60Bqct_iZRIZkJK7_0JK_HzWHgDgkWBMN4lTErrpSr6EiWVruZ3S1RTUNJYVyjWojmBGQsGPqG8DWrrJzDISN5G6TlhwOhWGDjomH4EZYmhy_y-jeHziKEErGkNI9MvcaEisYIhrzPK6AkmgNVZIBTzuHcy5Z3mjV3QtEcZPPXrr9Ek6mXfkxUhCrnn7us5tmDu7_8ABBvEKjIeCao>

## Colors

| Role | Light | Dark | Use for |
|---|---|---|---|
| `background` | #ffffff | #111116 | The page behind everything else. |
| `foreground` | #242426 | #e8e9eb | Default text and icons on the page. |
| `card` | #f9f8f9 | #181818 | The fill of cards and raised panels. |
| `card-foreground` | #242426 | #e8e9eb | Text and icons on a card. |
| `popover` | #f9f8f9 | #181818 | The fill of menus, tooltips and popovers. |
| `popover-foreground` | #242426 | #e8e9eb | Text and icons inside a popover. |
| `muted` | #eeeff1 | #1f2020 | Quiet fills for tabs, chips and disabled areas. |
| `muted-foreground` | #59585e | #9d9ea2 | Secondary text, captions and placeholders. |
| `secondary` | #e7f0fb | #1b2027 | The fill of secondary buttons. |
| `secondary-foreground` | #24344e | #c2d4ef | Text and icons on a secondary button. |
| `accent` | #faeafe | #251d28 | Hover and selected fills for list rows and menu items. |
| `accent-foreground` | #492651 | #e9c7f4 | Text and icons on an accent fill. |
| `primary` | #7969c7 | #7e71c2 | The fill of the main action and key highlights. |
| `primary-foreground` | #ffffff | #000000 | Text and icons on a primary fill. |
| `destructive` | #c05550 | #bd615b | The fill of actions that delete or cannot be undone. |
| `destructive-foreground` | #ffffff | #000000 | Text and icons on a destructive fill. |
| `destructive-subtle` | #feebe8 | #2b1c1a | A soft fill for error banners and invalid fields. |
| `destructive-subtle-foreground` | #5b211f | #fec5bf | Text and icons on a soft error fill. |
| `success` | #065123 | #8bc697 | The fill of success badges and confirmations. |
| `success-foreground` | #ffffff | #000000 | Text and icons on a success fill. |
| `success-subtle` | #e1f4e4 | #152318 | A soft fill for success banners. |
| `success-subtle-foreground` | #033d18 | #afdeb7 | Text and icons on a soft success fill. |
| `warning` | #d4812b | #8f5108 | The fill of warning badges and cautions. |
| `warning-foreground` | #000000 | #ffffff | Text and icons on a warning fill. |
| `warning-subtle` | #feecdb | #281e12 | A soft fill for warning banners. |
| `warning-subtle-foreground` | #542802 | #fbc8a9 | Text and icons on a soft warning fill. |
| `info` | #0b5b9c | #68a2de | The fill of informational badges and notices. |
| `info-foreground` | #ffffff | #000000 | Text and icons on an info fill. |
| `info-subtle` | #e3f1fe | #15212b | A soft fill for informational banners. |
| `info-subtle-foreground` | #08355d | #b1d6fe | Text and icons on a soft info fill. |
| `border` | #dfe0e3 | #2b2a2d | Dividers and the outlines of cards and panels. |
| `input` | #76767d | #7d7b81 | The outline of text fields, selects and other form controls. |
| `ring` | #7969c7 | #7e71c2 | The focus ring around the element that has keyboard focus. |
| `sidebar` | #f9f8f9 | #181818 | The fill of the sidebar. |
| `sidebar-foreground` | #242426 | #e8e9eb | Text and icons in the sidebar. |
| `sidebar-primary` | #7969c7 | #7e71c2 | The fill of the active item and main action in the sidebar. |
| `sidebar-primary-foreground` | #ffffff | #000000 | Text and icons on a sidebar primary fill. |
| `sidebar-accent` | #eeeff1 | #1f2020 | Hover and selected fills for sidebar items. |
| `sidebar-accent-foreground` | #333436 | #d3d2d5 | Text and icons on a sidebar accent fill. |
| `sidebar-border` | #dfe0e3 | #2b2a2d | Dividers and outlines inside the sidebar. |
| `sidebar-ring` | #7969c7 | #7e71c2 | The focus ring for elements in the sidebar. |
| `chart-1` | #7969c7 | #7e71c2 | The first series in charts. |
| `chart-2` | #59231a | #fdc7ae | The second series in charts. |
| `chart-3` | #c05647 | #d28f59 | The third series in charts. |
| `chart-4` | #18467d | #a2b7f3 | The fourth series in charts. |
| `chart-5` | #963a46 | #ad6e20 | The fifth series in charts. |

Eight scales (neutral, primary, secondary, accent, success, warning, danger, info), each with 11 steps from 50 to 950, sit behind these roles. They live in `app/theme.css` and `tokens/`.

## Typography

- Display: Young Serif (`@fontsource/young-serif`)
- Body: Onest (`@fontsource-variable/onest`)
- Mono: Fragment Mono (`@fontsource/fragment-mono`)

The display family sets `display` and `h1` to `h4`; the body family sets every other step.

| Step | Size | Line height | Tracking | Weight |
|---|---|---|---|---|
| `caption` | 10.24 px | 16 px | 0.0087 em | 400 |
| `label` | 12.8 px | 16 px | -0.0025 em | 500 |
| `body-sm` | 12.8 px | 20 px | -0.0025 em | 400 |
| `body` | 16 px | 24 px | -0.011 em | 400 |
| `lead` | 20 px | 32 px | -0.0167 em | 400 |
| `h4` | 20 px | 28 px | -0.0167 em | 400 |
| `h3` | 25 px | 32 px | -0.0199 em | 400 |
| `h2` | 31.25 px | 40 px | -0.0215 em | 400 |
| `h1` | 39.0625 px | 48 px | -0.0221 em | 400 |
| `display` | 48.8281 px | 52 px | -0.0223 em | 400 |

## Layout

The system uses a 4 px base and an 8 px rhythm. There are 12 units: 0, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128 px.

## Elevation & Depth

Depth style: soft. The five shadows, from `shadow-1` to `shadow-5`:

- `shadow-1`: 0 2px 4px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 1px 2px 0 oklch(0.2611 0.0045 289.00 / 0.06)
- `shadow-2`: 0 4px 8px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 2px 4px 0 oklch(0.2611 0.0045 289.00 / 0.06)
- `shadow-3`: 0 6px 12px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 3px 6px 0 oklch(0.2611 0.0045 289.00 / 0.06)
- `shadow-4`: 0 8px 16px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 4px 8px 0 oklch(0.2611 0.0045 289.00 / 0.06)
- `shadow-5`: 0 10px 20px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 5px 10px 0 oklch(0.2611 0.0045 289.00 / 0.06)

Dark mode shows elevation by surface lightness, not by shadow.

## Shapes

Radius set: soft. sm 4 px, md 8 px, lg 12 px, xl 16 px, 2xl 24 px, full 9999 px.

A nested element takes its parent's radius less its padding: inner radius = outer radius − padding.

## Components

- Cards: interactive-only
- Emphasis: one-filled-per-region
- Inputs: outlined
- Icons: lucide, 2 px stroke

## Do's and Don'ts

- Do pair every fill with its foreground role.
- Don't write a raw hex, rgb(), hsl() or oklch() value in a component.
- Don't use Tailwind's default palette classes such as bg-blue-500.
- Don't set body text under 16 px.

## Dark mode

Dark mode is a second value for each of the 46 roles, listed in the Colors table. Put the class `dark` on `html` to show it.

## Motion

Motion feel: brisk.

- Durations: instant 50ms, fast 100ms, quick 150ms, base 200ms, slow 300ms, slower 400ms, slowest 500ms
- Easings: standard cubic-bezier(0.2, 0, 0, 1), decelerate cubic-bezier(0, 0, 0, 1), accelerate cubic-bezier(0.3, 0, 1, 1), emphasized cubic-bezier(0.05, 0.7, 0.1, 1)
- `snappy`: visual duration 0.25 s, bounce 0.1, settles in 411 ms
- `smooth`: visual duration 0.4 s, bounce 0, settles in 706 ms
- `bouncy`: visual duration 0.5 s, bounce 0.35, settles in 1056 ms

Honor `prefers-reduced-motion`: drop movement and springs, and keep at most a fade.

## Accessibility

Contrast level: AA.

- 78 of 78 required contrast checks pass
- 16 of 16 color-vision checks keep status and chart colors apart
- 176 of 176 colors inside sRGB
- No lint errors, 1 warning, 2 notes

## Install

Two routes put this system into a Next.js app with Tailwind CSS v4. Pick one.

**Route 1: the stylesheet.** Copy `app/theme.css` into your app's `app/` folder. In `app/globals.css`, keep `@import "tailwindcss";` and add `@import "./theme.css";` right after it. If shadcn/ui wrote `globals.css`, delete its `@custom-variant dark`, `:root`, `.dark` and `@theme inline` blocks, because they would override this theme. If the template sets a `font-family` on `body`, remove it, so the theme's fonts apply. Install the fonts with `npm install @fontsource/young-serif @fontsource-variable/onest @fontsource/fragment-mono` and import each once in `app/layout.tsx`: `import "@fontsource/young-serif";` `import "@fontsource-variable/onest";` `import "@fontsource/fragment-mono";`. Put the class `dark` on `<html>` to show dark mode.

**Route 2: shadcn.** Run `npx shadcn@latest add ./registry/default.json`, then `npx shadcn@latest add ./registry/font-<id>.json` for each font file (`registry/font-young-serif.json`, `registry/font-onest.json`, `registry/font-fragment-mono.json`). Do not also import `app/theme.css`. This route sets the colors, the radius and the fonts; the type steps, shadows and easings live only in `app/theme.css`, so copy its `@theme` block if you need them.

Either way, copy `scripts/dyelot-check.mjs` and `receipt.json` into the app's root, and add the block in `AGENTS.md.snippet` to your `AGENTS.md`. The files in `tokens/` are the source of truth for design tools; `design.toon` is a compact view of the same colors for prompts.

```css
/* dyelot design system: Default (LOT 4177·a34c) */
/* Made with dyelot. Edit this design: https://dyelot.vercel.app/studio#s=rVzbjiM5cv0X-bW6nbyT_bbwGvCDDRiwYWMx2Ie8MKuEVklaSTUzvYP-9z3MCxnKDKUajZ3FYmpSqZNMknHixIX6Y9eeDqfL7ssfu3N9iLdbvKa_67aNx1v6q6svX3dffkn3HW-X-oqL4nNlghYvu7f4--7L7l9EK6zodi-709dD-5a-1O6-VJ8roaXHTbsvSoSX3SFdk6Iy0nx_2V1v8bz7YqrvL_fIwgiPmydkaUQn_RpZWrFC1trpgiyqFTTudQVaWalVs4bWzi6Rg1ROZ2S5RrZGVOlbI7JuZW_0Gtkptxy0MlZVBVotoeVnEUJwGdpa1Tq5ghaVEGYBrWVQNmRovYRWn6tK-wLtpW58v4ZOgHfABitYebKEC2CNO7AUGTj01tXxB4BtVVmXcfFf97gOA8ZkZdwm-rZtmblwaWdSYCeEUGWW3RI5fNbYzmkCR-TO1CGK9QL6IJez7IL0VRm0X-0NCWxTdl0Mreu5vSHSi1Fk76QLZdBhhWwwz15m5N5H2a-nudI6uGEAFDwoT3Z0gBn-FXd8xPme_esbHrE0elvpMkl919t-vV8qoYxevUzwQlZ2y-wxyrK0fR1r7l1UtTSgYIwyZTPyVp--NAGrzvX1GtgsbT4I6UwZMGvzVTGeaJqmX9tl5e1ywF5bYzYtHs_yhVs7Heq43jBr63EW_zyx90qWndj0rm0Ze18unfWAktvmDuIl5m66-gdwjVdWFb5mzd0O3xpxXa2VXy-dkMul085bXSaCsXbwUyiGYyul7dp7wVEtgUF8suwJztaBXDYbHgLHwGyK5VQopUDy26YuTJkKJUWjmF1s1dJzWS-dWtr5sX6Hoc8u_mV3jvXXf3u7nN7rcaFwf1cfX-MgCh65f1EmUES4f7vh_hNrZu9PPcfa-Y_kPTn_BsKCec3s_Auu1r5sUY4EwD5l62shpWCoa3b9BTdAI5SF4Vjgjt1NJxvpNjx_Rh4cf9n9LA0YX6zKRVjLluPPyPD70pUxczwgKoIcOm109ZBgMi7cPp72xO1T99xZYdb6aoULw3dEArE8YFSh2q71zjH8Mrv9DAyvr0SZYtbrV5Y4nao2gdkV2esX5IC1K_uNJwJHXHNsTcMgW5jRYl_A62uxTQXJnxPoqDipggFiOe6xg3J0QqjXH-7hnb7xA63Mj-tdb9aPq0KlJoYvj4MwcpvWroMnrjlGKDrG2oXXw3al0EZjOz7x-sTg-75zneK0EdZxJM2CLYSVxX3wap_qrtj4hnP9Qtsln8D5i_DE6vG1gm2D9oxrWtoQfL83hedZ32-JDUXEM5zLW6xgcv3iiesn4qrFnjMMkyxQ4fi1LxPM63xVYINTjVpvjNnxF-JzXosnfh-7olCqk1EyBDX5_YJbJb2wLfEHlz75gEYKzrlMXr94ALwj4Wne6etieqoXnvOyk9MvPgs-nzLInc-f_Drr8_fH_rTh8R0Jy4XGWDjtXzx-NQ8HGpi4UDbgH0xwQjZSMItCfX5G1gjqtklAEn8knGw1w5TF6WdgjJhIdJYBFFHSwqnWMNEK8foztNJO-CIh2XgfhFegvY5-PWjq9mdouI3KFmNlOUBpotp6q-otv5-BA3xZ2f8cC0hJYiEVfcV4uzUw9I0PhbVYIpBVmWfra9kxiYTi-WdkCxdZbVOBhGYsuY-m6eK265-hHSJZvR0EYEeRMEt0lgtlLXzjatzYeNo-i_lVGXdXx4aNk5GwUsuRB6UQ_z1w_-mmR0G_Iv5f9YEL-itE73ImuPxA5C_IZucEgPcFO4LhuJeRCna8NKQAbhQFm1cARSa1Aeic4odGHebzDht-TJZ9yap-ePcMXldt7Jn0p5cWNy6XWBlJ0josA1gy4040ul_T_tqaHEJE-0QDSBJdaSQW4zpWyd462xL-cXQVGRGgZOEViWxfyyQslrgGuLrwFWf98GNlvFVjmsCk-7IMyHwF9rYlUGGN3ysCHLRzXB5xaUAK8bx8IvuFK0RYYa0Nty-WUwFz9SR1w0sBVTgFO8toRnJmKZA9mU05uwdaYPD3rBI4xg88GQiPxIBFlo_4qPQ_hhNElXYFxpOUwyQGECdsZ_8Hwp09lAT_c8BD2voOGMqPpOt4OiAuG2E6fAkDPZNBQQZL62diQJXtr4Kq1Xo3IYaVy0FDDIRn0QDIj9QVdMvoa8TPcnZTGRtqwIViBHwWgKiBtFEsF9jNoVdBDsJ4KugYPqBW4DrXMBKGQQasepIRhAsryKELsWbMoHJ2CW1DQHloOxcAf1y8NsbccKsILbvEdl6BV59kA0g806lOdtxUm0kOZGRv4SsKMp8MGL41eVAfQ2TEM56-2iBBQT6vUoOjGhhuepANCISHoAV8HzgDXRo-pIAn889m_kyx_Bhj33N7ZvAzd8CD9twOAsrM97GKTBpgTpQUVGQLn-b9SIKnDfgfI10gyJdLCmFWZp3P_pNwqEYlpPkhs3RG2WI7rPcnE4ykpQ7MTlnuQOQVpKGEzRi7J7gOUsFxleClqVtniM1wpo6CXLFHExAscBM8qaDCTvYulc4aeiCZYIvkJ5NirlZWDl5Humhb91uSFEd4rxUTrg914jtgiYzttuZP1cniuiC0JQc81GDuXJdFVXqV75u8_-zjlwJgSPGeL_v3-vJtIxvgSSUd7t9tZwOoAPAkl8LzQHnVSkTJsHBJBhABANH3LCMoaG1BImLZyAYUZEgWX9KYPBcMwda08DViOMZLl2xAWXrEHsThsWygh9LktFs71Dk2swHFDqShWUy-GkgYzMLM6zU15jCjWC6451n13wmSZYtOtEzhYg0MTiK1KjYbQNKuIQbTbZUBCjPCCPyTOkAYpOrk-30jOOdTkgHE9Xsvypj5iIBMRif4SBFtHWO6-t77Y8M-SRBiSqj3d2wyANa5lJ7YsE6VVfxR7w-7Iwn7gFoAmwswoNUpFClP9KhJlKlipT_J9cQ-dhy4lOCPlbuGAifx04MmAFJT7ztIAcb4kXwcAsN7LYBmiSeNAKScBiGgOGxfBTQcLZdYI8R9kg7E5qVywPRMKnxlTA4FWaK3-GRAmZBgPaTjw5i9yAGHMsMzOUA6oRx2dfs4x1BsH6n7sF0SQNBBUuy6C0z5Yk4FFBYEx6sSsbMlgbH3YyJYZHIZ-ZJTAQUY4yGlNF7zB5K8t5JNEc-pgOISFDwkkeVsKsAVYDTI9VupACIGIPkeaIHZ3bPJgGvE06ECttRAIFUg9AJ4rhkQRjI1w8hUMZ-LA0h3b5cILekzbBAQM-V1KMWcICQZAbdNCTBlIjWkbBQTykiMeokMYiaJdpYRDHGtAG64NhANGbccNVICCPqexAeaNDF63Vkuuzy2O1DolBEw2xmBVOgqtuCxkIw0njvVCDIyAmVr8QmBYmOIoLua65FY4UJkQodvKwJNKmTQpD3DNqjx5xxhyQd4xPvPeoTKPNeqqTsmXgIbzlnCogmkkwX6gSYo89zKTnO1B4jn5YSgrwnE_iRUGELOyc91aKNjoNFG54fqBwVHecBS5rkrD2wlBIiq7jVEARumIcRZzRSSAqgwbwcDJG8CdVP1XMyK_oAlsoHYL8gPeoFpk10UPbNzMCVLZOwmt238WILCK41pm8iwYWqhXa6uQvD8pDJgCNEGhdoSEx2tDQm5AZQ5niQDiRxA_cq2DBmuNiQqA4FU8NjSILqQSRjvXP0jwCk_QGq7rCCAoyE1R1N7JrODHs4lWVktxLblQy8TZPRjWCa7nXPtJEGAyuC23UsSwCBi1ZqxldK2QzIEivQdsmYPAUXicYlkELObczmaZghInuteFRTHv8oRjFb7gQbC63Ba4FHLAMkVolwHN7GRJICxZ1WA4uV2pECr76jVceWHnCQgwMoH0sLGiwLSISLQoycYC5uTBAQZrRmkmYOlBUdLG_BJktuv8xoVaPSGWuJP-CMChCaFNF4yWj4nCQq0BpkRmmR5gaY2EIz0zMaaww8CDCd4F-yteQE9rMXGGt8yCmmNm4JW0kbO9wqSND5KkZ1jBjwnCQqyRZmHjJgtGlLCQXUATQYbSYICjT4jgD-LFUiM18VmQx8V4CSoAwni-cwh6c-KPVt4yCKmQKcWUkLsVAyMNz3qFaBiQPQNl0cRk-olT0MvxLbFQ4sV5oSv1kxLfD4dQIDROUgOfrAGDwIqM2RwPoOTeUt7x1zTVkq-RYBI0xA7VzMkNZ8PIIuKWhIpr7HmjgCk-OqqRVrsB2wHZIxiyaaxI7oqc6FNDbH5KHYnlgP-JckXPidAzgeICPHJZBqXuAZdls8kAKo0pIxvnWQSgiCiKTNO-AlZZnKmgZX_yMkVbLR8MnQNTkVZccnXcAXbTQIQFGWaoTE7zn1Nkojgoltmu0cA3aykq8GgfZ6xvkm3ENdlFA2FFhpg8vFsZuC3-nLcH1-32gRI8U10SVdtCABX_D8SeptZAeReSOjucQCBSYFkAWA9_HMqJs2VAgQt27EBHChxTkklPRYB1sItpd07CQH0IWy3C-CLZVbQsgNvtCEErAbPJ3c1VQyQAC1Tw7IDPYyDbnJUnNbwEOVjMh0PUFjN9L5T3QDHqYqHZbME6IcofrDHqQAuI4lYZdxpVgDUY66mXAEk2LYywHGA4rMw-Q2nZiZ6MwFt_oln5xKCJJPPHykiXWE4Wtob5kjRLA9SynEuIYDOnxwlINo-2rplSLmoA2PplkRrLY6bPTlEOCSPJ8_atJ4Lo2aJYDCLZUsii4IY-UkdgR6-6yMKTYx7NX52hEbSTYnNhDw2KxYGm354mJA0uve945IgQsFYxsXI9IBKAjzONj0QC8O5gpZL3cxq4Z4dsGtx8O-JYqAHCtuubh4rhntyQCkBaclnjYVFvvYKvp3LGk-q4Z4b0P1OY2Y-UCCnyLBJK8P0vU2mdc8LDlwetnlBwB2SjAr6ZJnm-nGD3nMCIidJVBrLCWBN0lKLuIzJ0qckx2Re97SA4xEk7GP7imiVDkdjYc0MLeCw6YIYUjs3Ua4PwgbSwtwigGEkeMBZkaHTa0kNmGhBNjt_-IAkKtEXCPNgqAHJtqEpa8kOKDhAAGzrCtSuijvsRFMxkeukK-6ZAQ2waEp9oC1m-cBoi9SCUF_q9yG50E6f7Jr6UB_bIZs2j-8_468RT9r96U-4-Fq_f2DEu-vlNe28t_ryfjqibLGrj_Xh9Hr6SDpm6nv43336dYNdc6mPCe_a4rcP_uuE7nJ8_YZr9aXbYRSX02H8PYRR4JTfRSA_TTBe-tSfLvH1cvoAHj3n3dTt13IZfhE7LV0-Xbp0wJK0IrbpmbSfMl1Yws4dXi3e7vZJ3FXYx2tyPJzdjmfux2sqe7vkNcZregg2ZeP6tJrjNTNcQ0VhaLvs4vV2-Whv-1_TtJQDfeT6YnjoKcA_i1uuH83tMCDkA53rjxdA-cTcg9cfz6qQIwHpwqPBDJ-VUeQjJuT64qu5aX9_PA9bqnQxYothB9Lu1OHKAiC3Jp5P59Ov40LndZ2uPVra3HxDlna69ugNL4MMJ_eToh0pm-WrC5xcgrjukXuo70c7XftUdn5-8_uPFqC5zXG-i9ny80cPZmL-mJuRxWePZma-bT1Dc_aS5HKmaw-xpo_vttKYe7z_aAGQMzo5YCK6ebq23P_DP-RjYkRzuHP_0RJglIigsEl-UerKP6_ALlw-tn5PXXlIZR1zP-VMXbkhlKGu3LdGqWvuDyDUZfBrKwNJEOrCyUIIgHvqQnZgbDUk1IWTE7VOz1hQVz6Z-Ji68uvx1JVPpz6lrnz-78Hrz9SVzzMw1JUHs6CufETmMXXlQweFuuaezExdub2Wo67cakmoK68rT1353aihzkvLG2h-w2yY8_131JVrfo-oK1dRCHXl0a6pK7_5JnXl3s01deUtz1NXngmOuvIbblJXnpkVdeXvF-rKiSmeugrWirpyEnWTunJ2ilBXlvY8dWW6XFNXDsU2qWuSsN-TCmxP7-fTESs0KkGwSnptaLd4qUcbPB0PqUAV389v9XWfPsX9n_r94YCdfcZWBfT-dEwGgR00wBz2kH3Dmhw-WkxymoTb5fQ1_jcUbkrdDaYzQH3cDvsjjCb9JEY83wa9e32ru9Nv-PiXX_76gqi2PuDRg3AFNx4-sE2grfOPaj1tzj31_TXe_oLPMIzzJdaYhEGDZ9zUUDUC45afAMa4CvCDISOg-QlkvOizIf8T5uLBkFOz9U9AY2TPxow_fgIYAdDzMf8cNFbn2Zj_CQv4YMwSiZef2XX42rNBp3t-Ahp3kFEjorzevg0Mcz31t2Sr7_GGJwESN8HD_f8-We4YNJ4OKQqMx1fY9f_FyzVxA87Ff4uH0-3zePlfk4OYgtQ_x77-OKRfybnGwXmmf0G8pIecbsOXERx-XOr098AuTX1NLTMVXq0fI-j05_6Ywkr8V8q7_-1j3yKaHHLw18PptyFZM_6ZvAxi_uk_0teHdMgugtyOr_mn-Q7gvxse8wsC-JfqRbwIzEIX6Qe4jA9weaLGv6fh4340vSGdg_-PX8rRbvpMTl_CA8HVKbBuLvvr1_T2cFbT8xsQdTt0Aw5_4WEpL_2y-3V__agPf57mYki8pMj__XQaeTPfzd06pH-O9fm8AMYuXN-MHxBMzuHyMQfnEFTgYvw7zfAvafgg6TMA_thd6m6_T3_I3_E-KYnafxzwF06BpA0Gj5Z45B3vn4zsfTCJdOdwuDh9-eP6P3HIKkx763qu09DGhU4eI9lQSh8Mk65f_AsAYed4FKofKL_iJ2Z89YK2AiF9Gtrt2ziytB3j7wn6fDl1kJRJM9bv-8N-fKvm1CUfBXeGbYCX21_Phzpd-YbZge-Ml31y7chxJD3ZX-rX9yRlhv-eUi7JSSV_d4z_EVMYkIabKGja3G19HqY0aY2_D-8iUn0EQ4R3_Yr1_nfMx9C6iT6tVO7cwDrUDTYMQUIi6B7o03CAC60Bqct_iZRIZkJK7_0JK_HzWHgDgkWBMN4lTErrpSr6EiWVruZ3S1RTUNJYVyjWojmBGQsGPqG8DWrrJzDISN5G6TlhwOhWGDjomH4EZYmhy_y-jeHziKEErGkNI9MvcaEisYIhrzPK6AkmgNVZIBTzuHcy5Z3mjV3QtEcZPPXrr9Ek6mXfkxUhCrnn7us5tmDu7_8ABBvEKjIeCao */
/* Generated: change the design in the studio and export it again, not by hand. */
@custom-variant dark (&:is(.dark *));

@theme {
  --color-*: initial;
  --color-white: #ffffff;
  --color-black: #000000;
  --font-display: "Young Serif", ui-serif, Georgia, "Times New Roman", serif;
  --font-heading: "Young Serif", ui-serif, Georgia, "Times New Roman", serif;
  --font-body: "Onest Variable", "Onest", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-sans: "Onest Variable", "Onest", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "Fragment Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --font-weight-heading: 400;
  --font-weight-label: 500;
  --font-weight-body: 400;
  --text-caption: 10.24px;
  --text-caption--line-height: 16px;
  --text-caption--letter-spacing: 0.00868415em;
  --text-caption--font-weight: var(--font-weight-body);
  --text-label: 12.8px;
  --text-label--line-height: 16px;
  --text-label--letter-spacing: -0.00247873em;
  --text-label--font-weight: var(--font-weight-label);
  --text-body-sm: 12.8px;
  --text-body-sm--line-height: 20px;
  --text-body-sm--letter-spacing: -0.00247873em;
  --text-body-sm--font-weight: var(--font-weight-body);
  --text-body: 16px;
  --text-body--line-height: 24px;
  --text-body--letter-spacing: -0.0109598em;
  --text-body--font-weight: var(--font-weight-body);
  --text-lead: 20px;
  --text-lead--line-height: 32px;
  --text-lead--letter-spacing: -0.0166573em;
  --text-lead--font-weight: var(--font-weight-body);
  --text-h4: 20px;
  --text-h4--line-height: 28px;
  --text-h4--letter-spacing: -0.0166573em;
  --text-h4--font-weight: var(--font-weight-heading);
  --text-h3: 25px;
  --text-h3--line-height: 32px;
  --text-h3--letter-spacing: -0.0199419em;
  --text-h3--font-weight: var(--font-weight-heading);
  --text-h2: 31.25px;
  --text-h2--line-height: 40px;
  --text-h2--letter-spacing: -0.0215077em;
  --text-h2--font-weight: var(--font-weight-heading);
  --text-h1: 39.0625px;
  --text-h1--line-height: 48px;
  --text-h1--letter-spacing: -0.0220973em;
  --text-h1--font-weight: var(--font-weight-heading);
  --text-display: 48.8281px;
  --text-display--line-height: 52px;
  --text-display--letter-spacing: -0.0222631em;
  --text-display--font-weight: var(--font-weight-heading);
  --leading-caption: 16px;
  --leading-label: 16px;
  --leading-body-sm: 20px;
  --leading-body: 24px;
  --leading-lead: 32px;
  --leading-h4: 28px;
  --leading-h3: 32px;
  --leading-h2: 40px;
  --leading-h1: 48px;
  --leading-display: 52px;
  --tracking-caption: 0.00868415em;
  --tracking-label: -0.00247873em;
  --tracking-body-sm: -0.00247873em;
  --tracking-body: -0.0109598em;
  --tracking-lead: -0.0166573em;
  --tracking-h4: -0.0166573em;
  --tracking-h3: -0.0199419em;
  --tracking-h2: -0.0215077em;
  --tracking-h1: -0.0220973em;
  --tracking-display: -0.0222631em;
  --spacing: 4px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --shadow-1: 0 2px 4px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 1px 2px 0 oklch(0.2611 0.0045 289.00 / 0.06);
  --shadow-2: 0 4px 8px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 2px 4px 0 oklch(0.2611 0.0045 289.00 / 0.06);
  --shadow-3: 0 6px 12px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 3px 6px 0 oklch(0.2611 0.0045 289.00 / 0.06);
  --shadow-4: 0 8px 16px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 4px 8px 0 oklch(0.2611 0.0045 289.00 / 0.06);
  --shadow-5: 0 10px 20px 0 oklch(0.2611 0.0045 289.00 / 0.1), 0 5px 10px 0 oklch(0.2611 0.0045 289.00 / 0.06);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0, 1);
  --ease-accelerate: cubic-bezier(0.3, 0, 1, 1);
  --ease-emphasized: cubic-bezier(0.05, 0.7, 0.1, 1);
}

:root {
  --radius: 12px;
  --background: #ffffff;
  --foreground: #242426;
  --card: #f9f8f9;
  --card-foreground: #242426;
  --popover: #f9f8f9;
  --popover-foreground: #242426;
  --muted: #eeeff1;
  --muted-foreground: #59585e;
  --secondary: #e7f0fb;
  --secondary-foreground: #24344e;
  --accent: #faeafe;
  --accent-foreground: #492651;
  --primary: #7969c7;
  --primary-foreground: #ffffff;
  --destructive: #c05550;
  --destructive-foreground: #ffffff;
  --destructive-subtle: #feebe8;
  --destructive-subtle-foreground: #5b211f;
  --success: #065123;
  --success-foreground: #ffffff;
  --success-subtle: #e1f4e4;
  --success-subtle-foreground: #033d18;
  --warning: #d4812b;
  --warning-foreground: #000000;
  --warning-subtle: #feecdb;
  --warning-subtle-foreground: #542802;
  --info: #0b5b9c;
  --info-foreground: #ffffff;
  --info-subtle: #e3f1fe;
  --info-subtle-foreground: #08355d;
  --border: #dfe0e3;
  --input: #76767d;
  --ring: #7969c7;
  --sidebar: #f9f8f9;
  --sidebar-foreground: #242426;
  --sidebar-primary: #7969c7;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #eeeff1;
  --sidebar-accent-foreground: #333436;
  --sidebar-border: #dfe0e3;
  --sidebar-ring: #7969c7;
  --chart-1: #7969c7;
  --chart-2: #59231a;
  --chart-3: #c05647;
  --chart-4: #18467d;
  --chart-5: #963a46;
  --neutral-50: #f9f8f9;
  --neutral-100: #eeeff1;
  --neutral-200: #dfe0e3;
  --neutral-300: #c9c9ce;
  --neutral-400: #afaeb5;
  --neutral-500: #95949b;
  --neutral-600: #76767d;
  --neutral-700: #59585e;
  --neutral-800: #46454a;
  --neutral-900: #333436;
  --neutral-950: #242426;
  --primary-50: #f9f7ff;
  --primary-100: #efedff;
  --primary-200: #dfddfe;
  --primary-300: #c9c3fe;
  --primary-400: #afa5f8;
  --primary-500: #9688e9;
  --primary-600: #7969c7;
  --primary-700: #5b4d9d;
  --primary-800: #473c7d;
  --primary-900: #362c5e;
  --primary-950: #251f42;
  --secondary-50: #f4f9fe;
  --secondary-100: #e7f0fb;
  --secondary-200: #d4e1f7;
  --secondary-300: #b5cbed;
  --secondary-400: #93b1dc;
  --secondary-500: #7696c9;
  --secondary-600: #5977a9;
  --secondary-700: #3e5a83;
  --secondary-800: #314668;
  --secondary-900: #24344e;
  --secondary-950: #182536;
  --accent-50: #fdf6ff;
  --accent-100: #faeafe;
  --accent-200: #f3d7fa;
  --accent-300: #e5bbf2;
  --accent-400: #d49ae4;
  --accent-500: #bf7ccf;
  --accent-600: #9f5daf;
  --accent-700: #7a438a;
  --accent-800: #60346d;
  --accent-900: #492651;
  --accent-950: #321b3a;
  --success-50: #f1fbf1;
  --success-100: #e1f4e4;
  --success-200: #c5e9cb;
  --success-300: #9ed7a8;
  --success-400: #70c082;
  --success-500: #45a761;
  --success-600: #1e8843;
  --success-700: #09672f;
  --success-800: #065123;
  --success-900: #033d18;
  --success-950: #052b11;
  --warning-50: #fff7ef;
  --warning-100: #feecdb;
  --warning-200: #fcdabb;
  --warning-300: #f3c08e;
  --warning-400: #e6a05c;
  --warning-500: #d4812b;
  --warning-600: #b1630d;
  --warning-700: #874908;
  --warning-800: #6c3805;
  --warning-900: #542802;
  --warning-950: #3d1b03;
  --danger-50: #fef7f5;
  --danger-100: #feebe8;
  --danger-200: #ffd7d3;
  --danger-300: #feb8b2;
  --danger-400: #f6948d;
  --danger-500: #e3746d;
  --danger-600: #c05550;
  --danger-700: #973b38;
  --danger-800: #772e2b;
  --danger-900: #5b211f;
  --danger-950: #3f1816;
  --info-50: #f3f9ff;
  --info-100: #e3f1fe;
  --info-200: #c9e3ff;
  --info-300: #a0cefd;
  --info-400: #71b4f6;
  --info-500: #4999e7;
  --info-600: #267ac4;
  --info-700: #0b5b9c;
  --info-800: #09477c;
  --info-900: #08355d;
  --info-950: #082542;
  --duration-instant: 50ms;
  --duration-fast: 100ms;
  --duration-quick: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 400ms;
  --duration-slowest: 500ms;
  --spring-duration: 0.25;
  --spring-bounce: 0.1;
  --icon-stroke: 2;
}

.dark {
  --background: #111116;
  --foreground: #e8e9eb;
  --card: #181818;
  --card-foreground: #e8e9eb;
  --popover: #181818;
  --popover-foreground: #e8e9eb;
  --muted: #1f2020;
  --muted-foreground: #9d9ea2;
  --secondary: #1b2027;
  --secondary-foreground: #c2d4ef;
  --accent: #251d28;
  --accent-foreground: #e9c7f4;
  --primary: #7e71c2;
  --primary-foreground: #000000;
  --destructive: #bd615b;
  --destructive-foreground: #000000;
  --destructive-subtle: #2b1c1a;
  --destructive-subtle-foreground: #fec5bf;
  --success: #8bc697;
  --success-foreground: #000000;
  --success-subtle: #152318;
  --success-subtle-foreground: #afdeb7;
  --warning: #8f5108;
  --warning-foreground: #ffffff;
  --warning-subtle: #281e12;
  --warning-subtle-foreground: #fbc8a9;
  --info: #68a2de;
  --info-foreground: #000000;
  --info-subtle: #15212b;
  --info-subtle-foreground: #b1d6fe;
  --border: #2b2a2d;
  --input: #7d7b81;
  --ring: #7e71c2;
  --sidebar: #181818;
  --sidebar-foreground: #e8e9eb;
  --sidebar-primary: #7e71c2;
  --sidebar-primary-foreground: #000000;
  --sidebar-accent: #1f2020;
  --sidebar-accent-foreground: #d3d2d5;
  --sidebar-border: #2b2a2d;
  --sidebar-ring: #7e71c2;
  --chart-1: #7e71c2;
  --chart-2: #fdc7ae;
  --chart-3: #d28f59;
  --chart-4: #a2b7f3;
  --chart-5: #ad6e20;
  --neutral-50: #181818;
  --neutral-100: #1f2020;
  --neutral-200: #2b2a2d;
  --neutral-300: #393a3c;
  --neutral-400: #4c4c50;
  --neutral-500: #606065;
  --neutral-600: #7d7b81;
  --neutral-700: #9d9ea2;
  --neutral-800: #b7b8bc;
  --neutral-900: #d3d2d5;
  --neutral-950: #e8e9eb;
  --primary-50: #18171f;
  --primary-100: #201e2c;
  --primary-200: #2b2742;
  --primary-300: #3a3460;
  --primary-400: #4d4481;
  --primary-500: #6255a3;
  --primary-600: #7e71c2;
  --primary-700: #9e95df;
  --primary-800: #b8b1f1;
  --primary-900: #d1cefd;
  --primary-950: #e8e7fe;
  --secondary-50: #16181d;
  --secondary-100: #1b2027;
  --secondary-200: #222b39;
  --secondary-300: #2b3b51;
  --secondary-400: #384d6e;
  --secondary-500: #48618a;
  --secondary-600: #637da7;
  --secondary-700: #879fc7;
  --secondary-800: #a3badb;
  --secondary-900: #c2d4ef;
  --secondary-950: #ddeaff;
  --accent-50: #1c161d;
  --accent-100: #251d28;
  --accent-200: #36243b;
  --accent-300: #4c2f54;
  --accent-400: #663c72;
  --accent-500: #824b8f;
  --accent-600: #9f67ae;
  --accent-700: #be8ccc;
  --accent-800: #d5a9e1;
  --accent-900: #e9c7f4;
  --accent-950: #f8e2fe;
  --success-50: #141915;
  --success-100: #152318;
  --success-200: #16301c;
  --success-300: #164223;
  --success-400: #125829;
  --success-500: #196f36;
  --success-600: #3b8c51;
  --success-700: #67ad76;
  --success-800: #8bc697;
  --success-900: #afdeb7;
  --success-950: #cef2d5;
  --warning-50: #1d1711;
  --warning-100: #281e12;
  --warning-200: #3b2610;
  --warning-300: #563107;
  --warning-400: #724006;
  --warning-500: #8f5108;
  --warning-600: #b26b29;
  --warning-700: #d28f5a;
  --warning-800: #e6ac82;
  --warning-900: #fbc8a9;
  --warning-950: #ffe4d4;
  --danger-50: #1e1616;
  --danger-100: #2b1c1a;
  --danger-200: #41221f;
  --danger-300: #5d2b27;
  --danger-400: #7e3632;
  --danger-500: #9d4540;
  --danger-600: #bd615b;
  --danger-700: #dc877f;
  --danger-800: #f0a59f;
  --danger-900: #fec5bf;
  --danger-950: #fee3e1;
  --info-50: #14181f;
  --info-100: #15212b;
  --info-200: #172c41;
  --info-300: #173c5e;
  --info-400: #184e81;
  --info-500: #1f63a0;
  --info-600: #3e80bf;
  --info-700: #68a2de;
  --info-800: #8bbdef;
  --info-900: #b1d6fe;
  --info-950: #daebfe;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-destructive-subtle: var(--destructive-subtle);
  --color-destructive-subtle-foreground: var(--destructive-subtle-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-success-subtle: var(--success-subtle);
  --color-success-subtle-foreground: var(--success-subtle-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-warning-subtle: var(--warning-subtle);
  --color-warning-subtle-foreground: var(--warning-subtle-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-info-subtle: var(--info-subtle);
  --color-info-subtle-foreground: var(--info-subtle-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-neutral-50: var(--neutral-50);
  --color-neutral-100: var(--neutral-100);
  --color-neutral-200: var(--neutral-200);
  --color-neutral-300: var(--neutral-300);
  --color-neutral-400: var(--neutral-400);
  --color-neutral-500: var(--neutral-500);
  --color-neutral-600: var(--neutral-600);
  --color-neutral-700: var(--neutral-700);
  --color-neutral-800: var(--neutral-800);
  --color-neutral-900: var(--neutral-900);
  --color-neutral-950: var(--neutral-950);
  --color-primary-50: var(--primary-50);
  --color-primary-100: var(--primary-100);
  --color-primary-200: var(--primary-200);
  --color-primary-300: var(--primary-300);
  --color-primary-400: var(--primary-400);
  --color-primary-500: var(--primary-500);
  --color-primary-600: var(--primary-600);
  --color-primary-700: var(--primary-700);
  --color-primary-800: var(--primary-800);
  --color-primary-900: var(--primary-900);
  --color-primary-950: var(--primary-950);
  --color-secondary-50: var(--secondary-50);
  --color-secondary-100: var(--secondary-100);
  --color-secondary-200: var(--secondary-200);
  --color-secondary-300: var(--secondary-300);
  --color-secondary-400: var(--secondary-400);
  --color-secondary-500: var(--secondary-500);
  --color-secondary-600: var(--secondary-600);
  --color-secondary-700: var(--secondary-700);
  --color-secondary-800: var(--secondary-800);
  --color-secondary-900: var(--secondary-900);
  --color-secondary-950: var(--secondary-950);
  --color-accent-50: var(--accent-50);
  --color-accent-100: var(--accent-100);
  --color-accent-200: var(--accent-200);
  --color-accent-300: var(--accent-300);
  --color-accent-400: var(--accent-400);
  --color-accent-500: var(--accent-500);
  --color-accent-600: var(--accent-600);
  --color-accent-700: var(--accent-700);
  --color-accent-800: var(--accent-800);
  --color-accent-900: var(--accent-900);
  --color-accent-950: var(--accent-950);
  --color-success-50: var(--success-50);
  --color-success-100: var(--success-100);
  --color-success-200: var(--success-200);
  --color-success-300: var(--success-300);
  --color-success-400: var(--success-400);
  --color-success-500: var(--success-500);
  --color-success-600: var(--success-600);
  --color-success-700: var(--success-700);
  --color-success-800: var(--success-800);
  --color-success-900: var(--success-900);
  --color-success-950: var(--success-950);
  --color-warning-50: var(--warning-50);
  --color-warning-100: var(--warning-100);
  --color-warning-200: var(--warning-200);
  --color-warning-300: var(--warning-300);
  --color-warning-400: var(--warning-400);
  --color-warning-500: var(--warning-500);
  --color-warning-600: var(--warning-600);
  --color-warning-700: var(--warning-700);
  --color-warning-800: var(--warning-800);
  --color-warning-900: var(--warning-900);
  --color-warning-950: var(--warning-950);
  --color-danger-50: var(--danger-50);
  --color-danger-100: var(--danger-100);
  --color-danger-200: var(--danger-200);
  --color-danger-300: var(--danger-300);
  --color-danger-400: var(--danger-400);
  --color-danger-500: var(--danger-500);
  --color-danger-600: var(--danger-600);
  --color-danger-700: var(--danger-700);
  --color-danger-800: var(--danger-800);
  --color-danger-900: var(--danger-900);
  --color-danger-950: var(--danger-950);
  --color-info-50: var(--info-50);
  --color-info-100: var(--info-100);
  --color-info-200: var(--info-200);
  --color-info-300: var(--info-300);
  --color-info-400: var(--info-400);
  --color-info-500: var(--info-500);
  --color-info-600: var(--info-600);
  --color-info-700: var(--info-700);
  --color-info-800: var(--info-800);
  --color-info-900: var(--info-900);
  --color-info-950: var(--info-950);
}

```

## Self-check before you finish

Run `node scripts/dyelot-check.mjs` from the app's root before you finish any UI change. It checks the theme against `receipt.json`, measures the 78 required contrast pairs again, and scans the source for raw colors and Tailwind palette classes. Fix every finding until it prints `PASS`. A raw color you must keep needs a comment on its line: `dyelot-check-ignore: <reason>`. Never edit `receipt.json` or `app/theme.css` by hand to make the check pass; change the design in the studio and export it again: https://dyelot.vercel.app/studio#s=rVzbjiM5cv0X-bW6nbyT_bbwGvCDDRiwYWMx2Ie8MKuEVklaSTUzvYP-9z3MCxnKDKUajZ3FYmpSqZNMknHixIX6Y9eeDqfL7ssfu3N9iLdbvKa_67aNx1v6q6svX3dffkn3HW-X-oqL4nNlghYvu7f4--7L7l9EK6zodi-709dD-5a-1O6-VJ8roaXHTbsvSoSX3SFdk6Iy0nx_2V1v8bz7YqrvL_fIwgiPmydkaUQn_RpZWrFC1trpgiyqFTTudQVaWalVs4bWzi6Rg1ROZ2S5RrZGVOlbI7JuZW_0Gtkptxy0MlZVBVotoeVnEUJwGdpa1Tq5ghaVEGYBrWVQNmRovYRWn6tK-wLtpW58v4ZOgHfABitYebKEC2CNO7AUGTj01tXxB4BtVVmXcfFf97gOA8ZkZdwm-rZtmblwaWdSYCeEUGWW3RI5fNbYzmkCR-TO1CGK9QL6IJez7IL0VRm0X-0NCWxTdl0Mreu5vSHSi1Fk76QLZdBhhWwwz15m5N5H2a-nudI6uGEAFDwoT3Z0gBn-FXd8xPme_esbHrE0elvpMkl919t-vV8qoYxevUzwQlZ2y-wxyrK0fR1r7l1UtTSgYIwyZTPyVp--NAGrzvX1GtgsbT4I6UwZMGvzVTGeaJqmX9tl5e1ywF5bYzYtHs_yhVs7Heq43jBr63EW_zyx90qWndj0rm0Ze18unfWAktvmDuIl5m66-gdwjVdWFb5mzd0O3xpxXa2VXy-dkMul085bXSaCsXbwUyiGYyul7dp7wVEtgUF8suwJztaBXDYbHgLHwGyK5VQopUDy26YuTJkKJUWjmF1s1dJzWS-dWtr5sX6Hoc8u_mV3jvXXf3u7nN7rcaFwf1cfX-MgCh65f1EmUES4f7vh_hNrZu9PPcfa-Y_kPTn_BsKCec3s_Auu1r5sUY4EwD5l62shpWCoa3b9BTdAI5SF4Vjgjt1NJxvpNjx_Rh4cf9n9LA0YX6zKRVjLluPPyPD70pUxczwgKoIcOm109ZBgMi7cPp72xO1T99xZYdb6aoULw3dEArE8YFSh2q71zjH8Mrv9DAyvr0SZYtbrV5Y4nao2gdkV2esX5IC1K_uNJwJHXHNsTcMgW5jRYl_A62uxTQXJnxPoqDipggFiOe6xg3J0QqjXH-7hnb7xA63Mj-tdb9aPq0KlJoYvj4MwcpvWroMnrjlGKDrG2oXXw3al0EZjOz7x-sTg-75zneK0EdZxJM2CLYSVxX3wap_qrtj4hnP9Qtsln8D5i_DE6vG1gm2D9oxrWtoQfL83hedZ32-JDUXEM5zLW6xgcv3iiesn4qrFnjMMkyxQ4fi1LxPM63xVYINTjVpvjNnxF-JzXosnfh-7olCqk1EyBDX5_YJbJb2wLfEHlz75gEYKzrlMXr94ALwj4Wne6etieqoXnvOyk9MvPgs-nzLInc-f_Drr8_fH_rTh8R0Jy4XGWDjtXzx-NQ8HGpi4UDbgH0xwQjZSMItCfX5G1gjqtklAEn8knGw1w5TF6WdgjJhIdJYBFFHSwqnWMNEK8foztNJO-CIh2XgfhFegvY5-PWjq9mdouI3KFmNlOUBpotp6q-otv5-BA3xZ2f8cC0hJYiEVfcV4uzUw9I0PhbVYIpBVmWfra9kxiYTi-WdkCxdZbVOBhGYsuY-m6eK265-hHSJZvR0EYEeRMEt0lgtlLXzjatzYeNo-i_lVGXdXx4aNk5GwUsuRB6UQ_z1w_-mmR0G_Iv5f9YEL-itE73ImuPxA5C_IZucEgPcFO4LhuJeRCna8NKQAbhQFm1cARSa1Aeic4odGHebzDht-TJZ9yap-ePcMXldt7Jn0p5cWNy6XWBlJ0josA1gy4040ul_T_tqaHEJE-0QDSBJdaSQW4zpWyd462xL-cXQVGRGgZOEViWxfyyQslrgGuLrwFWf98GNlvFVjmsCk-7IMyHwF9rYlUGGN3ysCHLRzXB5xaUAK8bx8IvuFK0RYYa0Nty-WUwFz9SR1w0sBVTgFO8toRnJmKZA9mU05uwdaYPD3rBI4xg88GQiPxIBFlo_4qPQ_hhNElXYFxpOUwyQGECdsZ_8Hwp09lAT_c8BD2voOGMqPpOt4OiAuG2E6fAkDPZNBQQZL62diQJXtr4Kq1Xo3IYaVy0FDDIRn0QDIj9QVdMvoa8TPcnZTGRtqwIViBHwWgKiBtFEsF9jNoVdBDsJ4KugYPqBW4DrXMBKGQQasepIRhAsryKELsWbMoHJ2CW1DQHloOxcAf1y8NsbccKsILbvEdl6BV59kA0g806lOdtxUm0kOZGRv4SsKMp8MGL41eVAfQ2TEM56-2iBBQT6vUoOjGhhuepANCISHoAV8HzgDXRo-pIAn889m_kyx_Bhj33N7ZvAzd8CD9twOAsrM97GKTBpgTpQUVGQLn-b9SIKnDfgfI10gyJdLCmFWZp3P_pNwqEYlpPkhs3RG2WI7rPcnE4ykpQ7MTlnuQOQVpKGEzRi7J7gOUsFxleClqVtniM1wpo6CXLFHExAscBM8qaDCTvYulc4aeiCZYIvkJ5NirlZWDl5Humhb91uSFEd4rxUTrg914jtgiYzttuZP1cniuiC0JQc81GDuXJdFVXqV75u8_-zjlwJgSPGeL_v3-vJtIxvgSSUd7t9tZwOoAPAkl8LzQHnVSkTJsHBJBhABANH3LCMoaG1BImLZyAYUZEgWX9KYPBcMwda08DViOMZLl2xAWXrEHsThsWygh9LktFs71Dk2swHFDqShWUy-GkgYzMLM6zU15jCjWC6451n13wmSZYtOtEzhYg0MTiK1KjYbQNKuIQbTbZUBCjPCCPyTOkAYpOrk-30jOOdTkgHE9Xsvypj5iIBMRif4SBFtHWO6-t77Y8M-SRBiSqj3d2wyANa5lJ7YsE6VVfxR7w-7Iwn7gFoAmwswoNUpFClP9KhJlKlipT_J9cQ-dhy4lOCPlbuGAifx04MmAFJT7ztIAcb4kXwcAsN7LYBmiSeNAKScBiGgOGxfBTQcLZdYI8R9kg7E5qVywPRMKnxlTA4FWaK3-GRAmZBgPaTjw5i9yAGHMsMzOUA6oRx2dfs4x1BsH6n7sF0SQNBBUuy6C0z5Yk4FFBYEx6sSsbMlgbH3YyJYZHIZ-ZJTAQUY4yGlNF7zB5K8t5JNEc-pgOISFDwkkeVsKsAVYDTI9VupACIGIPkeaIHZ3bPJgGvE06ECttRAIFUg9AJ4rhkQRjI1w8hUMZ-LA0h3b5cILekzbBAQM-V1KMWcICQZAbdNCTBlIjWkbBQTykiMeokMYiaJdpYRDHGtAG64NhANGbccNVICCPqexAeaNDF63Vkuuzy2O1DolBEw2xmBVOgqtuCxkIw0njvVCDIyAmVr8QmBYmOIoLua65FY4UJkQodvKwJNKmTQpD3DNqjx5xxhyQd4xPvPeoTKPNeqqTsmXgIbzlnCogmkkwX6gSYo89zKTnO1B4jn5YSgrwnE_iRUGELOyc91aKNjoNFG54fqBwVHecBS5rkrD2wlBIiq7jVEARumIcRZzRSSAqgwbwcDJG8CdVP1XMyK_oAlsoHYL8gPeoFpk10UPbNzMCVLZOwmt238WILCK41pm8iwYWqhXa6uQvD8pDJgCNEGhdoSEx2tDQm5AZQ5niQDiRxA_cq2DBmuNiQqA4FU8NjSILqQSRjvXP0jwCk_QGq7rCCAoyE1R1N7JrODHs4lWVktxLblQy8TZPRjWCa7nXPtJEGAyuC23UsSwCBi1ZqxldK2QzIEivQdsmYPAUXicYlkELObczmaZghInuteFRTHv8oRjFb7gQbC63Ba4FHLAMkVolwHN7GRJICxZ1WA4uV2pECr76jVceWHnCQgwMoH0sLGiwLSISLQoycYC5uTBAQZrRmkmYOlBUdLG_BJktuv8xoVaPSGWuJP-CMChCaFNF4yWj4nCQq0BpkRmmR5gaY2EIz0zMaaww8CDCd4F-yteQE9rMXGGt8yCmmNm4JW0kbO9wqSND5KkZ1jBjwnCQqyRZmHjJgtGlLCQXUATQYbSYICjT4jgD-LFUiM18VmQx8V4CSoAwni-cwh6c-KPVt4yCKmQKcWUkLsVAyMNz3qFaBiQPQNl0cRk-olT0MvxLbFQ4sV5oSv1kxLfD4dQIDROUgOfrAGDwIqM2RwPoOTeUt7x1zTVkq-RYBI0xA7VzMkNZ8PIIuKWhIpr7HmjgCk-OqqRVrsB2wHZIxiyaaxI7oqc6FNDbH5KHYnlgP-JckXPidAzgeICPHJZBqXuAZdls8kAKo0pIxvnWQSgiCiKTNO-AlZZnKmgZX_yMkVbLR8MnQNTkVZccnXcAXbTQIQFGWaoTE7zn1Nkojgoltmu0cA3aykq8GgfZ6xvkm3ENdlFA2FFhpg8vFsZuC3-nLcH1-32gRI8U10SVdtCABX_D8SeptZAeReSOjucQCBSYFkAWA9_HMqJs2VAgQt27EBHChxTkklPRYB1sItpd07CQH0IWy3C-CLZVbQsgNvtCEErAbPJ3c1VQyQAC1Tw7IDPYyDbnJUnNbwEOVjMh0PUFjN9L5T3QDHqYqHZbME6IcofrDHqQAuI4lYZdxpVgDUY66mXAEk2LYywHGA4rMw-Q2nZiZ6MwFt_oln5xKCJJPPHykiXWE4Wtob5kjRLA9SynEuIYDOnxwlINo-2rplSLmoA2PplkRrLY6bPTlEOCSPJ8_atJ4Lo2aJYDCLZUsii4IY-UkdgR6-6yMKTYx7NX52hEbSTYnNhDw2KxYGm354mJA0uve945IgQsFYxsXI9IBKAjzONj0QC8O5gpZL3cxq4Z4dsGtx8O-JYqAHCtuubh4rhntyQCkBaclnjYVFvvYKvp3LGk-q4Z4b0P1OY2Y-UCCnyLBJK8P0vU2mdc8LDlwetnlBwB2SjAr6ZJnm-nGD3nMCIidJVBrLCWBN0lKLuIzJ0qckx2Re97SA4xEk7GP7imiVDkdjYc0MLeCw6YIYUjs3Ua4PwgbSwtwigGEkeMBZkaHTa0kNmGhBNjt_-IAkKtEXCPNgqAHJtqEpa8kOKDhAAGzrCtSuijvsRFMxkeukK-6ZAQ2waEp9oC1m-cBoi9SCUF_q9yG50E6f7Jr6UB_bIZs2j-8_468RT9r96U-4-Fq_f2DEu-vlNe28t_ryfjqibLGrj_Xh9Hr6SDpm6nv43336dYNdc6mPCe_a4rcP_uuE7nJ8_YZr9aXbYRSX02H8PYRR4JTfRSA_TTBe-tSfLvH1cvoAHj3n3dTt13IZfhE7LV0-Xbp0wJK0IrbpmbSfMl1Yws4dXi3e7vZJ3FXYx2tyPJzdjmfux2sqe7vkNcZregg2ZeP6tJrjNTNcQ0VhaLvs4vV2-Whv-1_TtJQDfeT6YnjoKcA_i1uuH83tMCDkA53rjxdA-cTcg9cfz6qQIwHpwqPBDJ-VUeQjJuT64qu5aX9_PA9bqnQxYothB9Lu1OHKAiC3Jp5P59Ov40LndZ2uPVra3HxDlna69ugNL4MMJ_eToh0pm-WrC5xcgrjukXuo70c7XftUdn5-8_uPFqC5zXG-i9ny80cPZmL-mJuRxWePZma-bT1Dc_aS5HKmaw-xpo_vttKYe7z_aAGQMzo5YCK6ebq23P_DP-RjYkRzuHP_0RJglIigsEl-UerKP6_ALlw-tn5PXXlIZR1zP-VMXbkhlKGu3LdGqWvuDyDUZfBrKwNJEOrCyUIIgHvqQnZgbDUk1IWTE7VOz1hQVz6Z-Ji68uvx1JVPpz6lrnz-78Hrz9SVzzMw1JUHs6CufETmMXXlQweFuuaezExdub2Wo67cakmoK68rT1353aihzkvLG2h-w2yY8_131JVrfo-oK1dRCHXl0a6pK7_5JnXl3s01deUtz1NXngmOuvIbblJXnpkVdeXvF-rKiSmeugrWirpyEnWTunJ2ilBXlvY8dWW6XFNXDsU2qWuSsN-TCmxP7-fTESs0KkGwSnptaLd4qUcbPB0PqUAV389v9XWfPsX9n_r94YCdfcZWBfT-dEwGgR00wBz2kH3Dmhw-WkxymoTb5fQ1_jcUbkrdDaYzQH3cDvsjjCb9JEY83wa9e32ru9Nv-PiXX_76gqi2PuDRg3AFNx4-sE2grfOPaj1tzj31_TXe_oLPMIzzJdaYhEGDZ9zUUDUC45afAMa4CvCDISOg-QlkvOizIf8T5uLBkFOz9U9AY2TPxow_fgIYAdDzMf8cNFbn2Zj_CQv4YMwSiZef2XX42rNBp3t-Ahp3kFEjorzevg0Mcz31t2Sr7_GGJwESN8HD_f8-We4YNJ4OKQqMx1fY9f_FyzVxA87Ff4uH0-3zePlfk4OYgtQ_x77-OKRfybnGwXmmf0G8pIecbsOXERx-XOr098AuTX1NLTMVXq0fI-j05_6Ywkr8V8q7_-1j3yKaHHLw18PptyFZM_6ZvAxi_uk_0teHdMgugtyOr_mn-Q7gvxse8wsC-JfqRbwIzEIX6Qe4jA9weaLGv6fh4340vSGdg_-PX8rRbvpMTl_CA8HVKbBuLvvr1_T2cFbT8xsQdTt0Aw5_4WEpL_2y-3V__agPf57mYki8pMj__XQaeTPfzd06pH-O9fm8AMYuXN-MHxBMzuHyMQfnEFTgYvw7zfAvafgg6TMA_thd6m6_T3_I3_E-KYnafxzwF06BpA0Gj5Z45B3vn4zsfTCJdOdwuDh9-eP6P3HIKkx763qu09DGhU4eI9lQSh8Mk65f_AsAYed4FKofKL_iJ2Z89YK2AiF9Gtrt2ziytB3j7wn6fDl1kJRJM9bv-8N-fKvm1CUfBXeGbYCX21_Phzpd-YbZge-Ml31y7chxJD3ZX-rX9yRlhv-eUi7JSSV_d4z_EVMYkIabKGja3G19HqY0aY2_D-8iUn0EQ4R3_Yr1_nfMx9C6iT6tVO7cwDrUDTYMQUIi6B7o03CAC60Bqct_iZRIZkJK7_0JK_HzWHgDgkWBMN4lTErrpSr6EiWVruZ3S1RTUNJYVyjWojmBGQsGPqG8DWrrJzDISN5G6TlhwOhWGDjomH4EZYmhy_y-jeHziKEErGkNI9MvcaEisYIhrzPK6AkmgNVZIBTzuHcy5Z3mjV3QtEcZPPXrr9Ek6mXfkxUhCrnn7us5tmDu7_8ABBvEKjIeCao
