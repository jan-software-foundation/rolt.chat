// I give up
// I fucking hate SVGs
// Why can't I fucking import an SVG and have it inherit it's goddamn color

export default (props: { width: number; height: number }) => (
    <svg
        width={props.width}
        height={props.height}
        viewBox="0 0 512 512"
        fill="currentColor"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg">
        <path
            fill="currentColor"
            d="m 255.99998,31.695263 c -19.39785,0 -51.81282,7.446567 -82.31588,15.736331 -18.81321,5.175537 -37.5388,10.662784 -56.16815,16.46174 L 404.43144,350.81026 C 439.12894,290.97485 462.50288,210.00205 448.8293,107.3417 447.77063,99.270274 444.45386,91.659951 439.26253,85.386966 434.07119,79.11398 427.21357,74.432583 419.47971,71.878571 400.98108,65.836854 369.52135,55.862131 338.31586,47.431594 307.8128,39.14183 275.39783,31.695263 255.99998,31.695263 Z"
        />
        <path
            fill="currentColor"
            d="m 308.76948,456.9971 c -9.3039,6.68237 -19.16083,12.55746 -29.46307,17.56349 -7.87175,3.70892 -16.33389,6.74415 -23.30643,6.74415 -6.97254,0 -15.40595,-3.03523 -23.30643,-6.74415 C 222.39131,469.55456 212.53438,463.67947 203.23048,456.9971 176.32717,437.68831 152.47489,414.45226 132.46942,388.06751 92.563346,335.88839 58.591257,261.12681 59.214677,163.1694 l 1.014135,-26.78121 c 0.639221,-9.30246 1.588716,-18.79597 2.867158,-28.48484 L 363.17366,407.98105 379.53054,388.06751 74.669464,83.206431 92.520253,71.878571 391.72028,371.07859 l -0.2442,0.39072 c -3.90141,5.76592 -7.89331,11.29769 -11.94554,16.5982 l -16.35688,19.91354 c -5.01034,5.6352 -10.20886,11.09659 -15.58694,16.37411 L 333.159,437.69405 c -7.8143,6.80448 -15.9518,13.24696 -24.38952,19.30305 z"
        />
    </svg>
);
