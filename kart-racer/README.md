# Adaptive Kart Racer

정적 호스팅으로 바로 배포할 수 있는 Three.js 기반 카트 레이싱 게임입니다.

## 포함 기능

- 모바일 좌/우 조향 버튼
- 숏 드리프트 / 풀 드리프트 / 카운터 스티어
- 최대 드리프트각 40도
- 브레이크 + 최대 -20 km/h 후진
- 드리프트 중 추종 카메라
- 가드레일 접촉 마찰 및 최소 10 km/h 탈출 속도
- 끼임 감지 시 약 10m 이전 지점으로 즉시 복구 후 4초간 차량 깜빡임
- AI 5대, 추월/회피/숏·풀 드리프트
- 플레이어/AI 및 AI/AI 차량 충돌
- 실시간 순위 및 랩 표시
- 플레이어 랩별 주행선/속도/드리프트를 AI가 학습
- 학습 결과를 브라우저 localStorage에 저장해 새로고침 후에도 유지
- Cosmo Low Poly Cars GLB 에셋 사용

## 로컬 실행

ES Module과 GLB 파일을 사용하므로 `index.html`을 `file://`로 직접 열기보다는 간단한 HTTP 서버를 사용하세요.

Python이 있다면 프로젝트 폴더에서:

```bash
python -m http.server 8080
```

그 뒤 브라우저에서 `http://localhost:8080`을 엽니다.

Node.js가 있다면:

```bash
npx serve .
```

## GitHub Pages

1. 이 폴더의 내용을 GitHub 저장소 루트에 업로드합니다.
2. GitHub 저장소의 **Settings → Pages**로 이동합니다.
3. **Deploy from a branch**를 선택합니다.
4. `main` 브랜치와 `/ (root)`를 선택합니다.
5. 배포된 Pages 주소로 접속합니다.

`.nojekyll` 파일이 포함되어 있습니다.

## Cloudflare Pages / Netlify

빌드 과정이 필요 없는 정적 사이트입니다.

- Build command: 비워 둠
- Output directory: `/` 또는 프로젝트 루트

프로젝트 파일을 그대로 업로드하면 됩니다.

## 파일 구조

```text
kart-racer-deploy/
├── index.html
├── game.js
├── .nojekyll
├── README.md
└── assets/
    ├── LOW_POLY_CARS_LICENSE.txt
    └── cars/
        ├── armor.glb
        ├── coupe.glb
        ├── fenyr.glb
        ├── ghini.glb
        ├── italia.glb
        ├── jeep.glb
        ├── kamaro.glb
        ├── lamb.glb
        ├── mobil.glb
        ├── police.glb
        ├── rally.glb
        └── van.glb
```

## 외부 런타임 의존성

Three.js와 GLTFLoader는 jsDelivr CDN에서 로드합니다. 따라서 플레이 시 인터넷 연결이 필요합니다.

## 차량 에셋

`assets/cars/`의 차량 모델은 사용자가 제공한 **Cosmo - Low Poly Cars** 에셋입니다. 원본 라이선스 전문은 `assets/LOW_POLY_CARS_LICENSE.txt`를 확인하세요.
