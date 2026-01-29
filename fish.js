/**
 * fish.js - DESU™ Random Fish Animation
 */

document.addEventListener('DOMContentLoaded', () => {
    const arowana = document.querySelector('.arowana');
    if (!arowana) return;

    // 初期状態を非表示に（JSがロードされるまで）
    arowana.style.display = 'none';

    function startSwim() {
        // 画面の幅とサカナの幅を取得
        const fishWidth = arowana.offsetWidth || 800;
        const screenWidth = window.innerWidth;

        // ランダムな設定
        const isFromRight = Math.random() > 0.5;
        const startTop = Math.random() * 60 + 10; // 10% - 70%
        const endTop = startTop + (Math.random() * 20 - 10); // ±10% の揺れ
        const duration = Math.random() * 30 + 30; // 30s - 60s
        const delay = Math.random() * 5000 + 2000; // 2s - 7s 次の出現までの間隔

        // 向きと位置の初期化
        arowana.style.transition = 'none';
        arowana.style.display = 'block';
        arowana.style.top = `${startTop}%`;

        if (isFromRight) {
            // 右から左へ（デフォルトの向き: 左）
            arowana.style.left = `${screenWidth + 100}px`;
            arowana.style.transform = 'scaleX(1) translateZ(0)';
        } else {
            // 左から右へ（反転）
            arowana.style.left = `-${fishWidth + 100}px`;
            arowana.style.transform = 'scaleX(-1) translateZ(0)';
        }

        // ブラウザのレンダリングを待ってからアニメーション開始
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                arowana.style.transition = `left ${duration}s linear, top ${duration}s ease-in-out`;

                // 少し時間をおいてから書き換えないとtransitionが効かない場合があるため
                // すでにRAFの中だが、プロパティの書き換えを確実にする
                arowana.style.top = `${endTop}%`;

                if (isFromRight) {
                    arowana.style.left = `-${fishWidth + 100}px`;
                } else {
                    arowana.style.left = `${screenWidth + 100}px`;
                }
            });
        });
    }

    // アニメーション終了時に次の泳ぎを予約
    arowana.addEventListener('transitionend', (e) => {
        // left のアニメーションが終わった時だけ反応させる
        if (e.propertyName === 'left') {
            arowana.style.display = 'none';
            const nextDelay = Math.random() * 10000 + 5000; // 5s - 15s 休む
            setTimeout(startSwim, nextDelay);
        }
    });

    // 初期化完了ログ（デバッグ用）
    console.log('Fish animation initialized');
    // 初回の泳ぎを開始（少し待ってから）
    setTimeout(startSwim, 1000);
});
