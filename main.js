import { m4, primitives, createProgramInfo, resizeCanvasToDisplaySize, setBuffersAndAttributes, setUniforms, drawBufferInfo } from './libs/twgl.full.module.js';

// --- SHADERS ---
const vsSource = `
precision mediump float;
uniform mat4 u_worldViewProjection;
uniform mat4 u_world;
attribute vec4 position;
attribute vec3 normal;
varying vec3 v_normal;
varying vec3 v_worldPos;

void main() {
    gl_Position = u_worldViewProjection * position;
    v_normal = mat3(u_world) * normal;
    v_worldPos = (u_world * position).xyz;
}
`;

// --- FRAGMENT SHADER ---
const fsSource = `
precision mediump float;

varying vec3 v_normal;
varying vec3 v_worldPos;
uniform vec3 u_lightDirection;
uniform vec4 u_color;
uniform vec3 u_ovniPos;
uniform float u_raioIntensidade;
uniform float u_iluminacaoAtiva;
uniform float u_fogAtiva;

void main() {
    vec3 lightDir = normalize(-u_lightDirection);
    float brightness = dot(normalize(v_normal), lightDir);
    
    // 4 níveis de toon ao invés de 3
    float toon;
    if      (brightness > 0.85) toon = 1.0;
    else if (brightness > 0.55) toon = 0.7;
    else if (brightness > 0.20) toon = 0.4;
    else                        toon = 0.15;
    
    float distancia = length(v_worldPos.xz - u_ovniPos.xz);
    float alcance = 8.0 + u_ovniPos.y * 0.2;
    float claridade = max(0.0, 1.0 - (distancia / alcance)) * u_raioIntensidade;
    toon = max(toon, claridade);

    
    float brilhoFinal = mix(1.0, toon, u_iluminacaoAtiva);
    //Fog
    float distanciaCamera = length(gl_FragCoord.z/ gl_FragCoord.w);
    float fogInicio = 100.0;
    float fogFim = 180.0;
    float fogFactor = clamp((fogFim - distanciaCamera) / (fogFim - fogInicio), 0.0, 1.0);
    vec3 corFog = vec3(0.7, 0.8, 0.9);
    vec3 corFinal = mix(corFog, u_color.rgb * brilhoFinal, fogFactor);

    gl_FragColor = vec4(mix(u_color.rgb * brilhoFinal, corFinal, u_fogAtiva), u_color.a);

}
`;



// --- CONFIGURAÇÃO INICIAL ---
const canvas = document.getElementById("gameCanvas");
const gl = canvas.getContext("webgl2");

const vsOutline = `
precision mediump float;
uniform mat4 u_worldViewProjection;
uniform mat4 u_world;
attribute vec4 position;
attribute vec3 normal;

void main() {
    // Expande o objeto levemente ao longo das normais
    vec3 norm = normalize(mat3(u_world) * normal);
    vec4 pos = position + vec4(norm * 0.08, 0.0);
    gl_Position = u_worldViewProjection * pos;
}
`;

const fsOutline = `
precision mediump float;
void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Preto sólido
}
`;

const outlineProgramInfo = createProgramInfo(gl, [vsOutline, fsOutline]);

// Verifica se o WebGL2 está funcionando
if (!gl) {
    alert("Seu navegador não suporta WebGL2!");
}

// Compila os shaders magicamente
const programInfo = createProgramInfo(gl, [vsSource, fsSource]);

//Função de Geração Procedimental
//Vai devolver o mesmo número entre 0 e 1 para as mesmas coodernada X e Z
function pseudoRandom(x, z) {
    let n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

// --- FUNÇÃO PARA CRIAR OUTLINE ---
function desenharComOutline(bufferInfo, worldMatrix, viewProjection, color) {
    const wvp = m4.multiply(viewProjection, worldMatrix);
    gl.cullFace(gl.FRONT); // Renderiza só as faces de trás
    gl.enable(gl.CULL_FACE);
    gl.useProgram(outlineProgramInfo.program);
    setBuffersAndAttributes(gl, outlineProgramInfo, bufferInfo);
    setUniforms(outlineProgramInfo, {
        u_worldViewProjection: wvp,
        u_world: worldMatrix,
    });
    drawBufferInfo(gl, bufferInfo);

    gl.cullFace(gl.BACK);
    gl.useProgram(programInfo.program);
    setBuffersAndAttributes(gl, programInfo, bufferInfo);
    setUniforms(programInfo, {
        u_worldViewProjection: wvp,
        u_world: worldMatrix,
        u_color: color,
    });
    drawBufferInfo(gl, bufferInfo);
}

// --- CRIAÇÃO DOS OBJETOS 3D ---
// Chão (Plane): O "10, 10" no final significa poucas subdivisões (ideal para low-poly!)
const chaoBuffer = primitives.createPlaneBufferInfo(gl, 400, 400, 10, 10);

// --- CRIAÇÃO DO OVNI ---
// 1. Corpo/Chassi:
const corpoOvniBuffer = primitives.createTruncatedConeBufferInfo(gl, 2.3, 2, 0.5, 10, 1);
// 2. Cabine : 
const cabineOvniBuffer = primitives.createSphereBufferInfo(gl, 1.5, 30, 30);
// 3. Anel :
const anelOvniBuffer = primitives.createTorusBufferInfo(gl, 3.5, 0.2, 10, 12);
// Raio de abdução 
const raioAbducaoBuffer = primitives.createTruncatedConeBufferInfo(gl, 3.5, 0.1, 8, 30, 1);
// Sombra 
const sombraBuffer = primitives.createDiscBufferInfo(gl, 3, 20);
// --- OBJETOS DA FAZENDA ---

// --- SILO ---
const siloCilindroBuffer = primitives.createCylinderBufferInfo(gl,2,6,16,1);
const siloTetoBuffer = primitives.createSphereBufferInfo(gl, 2, 16, 16);
function desenharSilo(viewProjectionMatrix, posX, posZ){
    desenharComOutline(siloCilindroBuffer, m4.translation([posX, 3, posZ]), viewProjectionMatrix, [0.7, 0.7, 0.7, 1]);
    desenharComOutline(siloTetoBuffer, m4.translation([posX, 6, posZ]), viewProjectionMatrix, [0.5, 0.5, 0.5, 1]);
}

// --- CELEIRO ---
const celeiroCorpoBuffer = primitives.createCubeBufferInfo(gl,4);
const celeiroTetoBuffer = primitives.createTruncatedConeBufferInfo(gl,3.5, 0, 2, 4, 1);
function desenharCeleiro(viewProjectionMatrix, posX, posZ){
    //Desenha o corpo do celeiro
    desenharComOutline(celeiroCorpoBuffer, m4.translation([posX, 2, posZ]), viewProjectionMatrix, [0.7, 0.1, 0.1, 1]);
    let matrizTeto = m4.rotateY(m4.translation([posX, 5, posZ]), Math.PI / 4);
    //Desenha o teto do celeiro
    desenharComOutline(celeiroTetoBuffer,  matrizTeto, viewProjectionMatrix, [0.3, 0.2, 0.1, 1]);
}

// --- ÁRVORE --- 
const troncoBuffer = primitives.createCylinderBufferInfo(gl, 0.5, 2, 6, 1); // Raio 0.5, Altura 2
const folhasBuffer = primitives.createTruncatedConeBufferInfo(gl, 2, 0, 3, 6, 1); // Raio base 2, topo 0, Altura 3
function desenharArvore(viewProjectionMatrix, posX, posZ){
    // Desenha o tronco
    desenharComOutline(troncoBuffer,  m4.translation([posX, 1,   posZ]), viewProjectionMatrix, [0.55, 0.27, 0.07, 1]);
    // Desenha as folhas
    desenharComOutline(folhasBuffer,  m4.translation([posX, 3.5, posZ]), viewProjectionMatrix, [0.2,  0.8,  0.2,  1]);
}

// --- VACA ---
const corpoVacaBuffer = primitives.createSphereBufferInfo(gl, 1.5, 4, 3);     // corpo oval low-poly
const cabecaVacaBuffer = primitives.createSphereBufferInfo(gl, 0.7, 4, 3);    // cabeça
const pataVacaBuffer = primitives.createCylinderBufferInfo(gl, 0.2, 1, 4, 1); // pata (reutilizada 4x)
const raboPataBuffer = primitives.createCylinderBufferInfo(gl, 0.1, 0.8, 4, 1); // rabo

function desenharVaca(viewProjectionMatrix, posX, posZ) {
    // Corpo
    let matrizBase = m4.translation([posX, 1.5, posZ]);
    matrizBase = m4.rotateY(matrizBase, (pseudoRandom(posX, posZ)*Math.PI));

    let matrizCorpo = m4.translate(matrizBase, [0, 1.5, 0]);
    matrizCorpo = m4.scale(matrizCorpo, [1.5, 1, 1]);
    desenharComOutline(corpoVacaBuffer, matrizCorpo, viewProjectionMatrix, [0.8, 0.6, 0.4, 1]); // marrom claro

    // Cabeça
    let matrizCabeca = m4.translate(matrizBase, [1.8, 1.8, 0]);
    desenharComOutline(cabecaVacaBuffer, matrizCabeca, viewProjectionMatrix, [0.8, 0.6, 0.4, 1]);

    // 4 Patas
    const offsetsPatas = [
        [0.8,  0.3],  // frente direita
        [0.8, -0.3],  // frente esquerda
        [-0.8,  0.3], // trás direita
        [-0.8, -0.3], // trás esquerda
    ];
    for (let [ox, oz] of offsetsPatas) {
        let matrizPata = m4.translate(matrizBase, [ox, 0.5, oz]);
        desenharComOutline(pataVacaBuffer, matrizPata, viewProjectionMatrix, [0.9, 0.9, 0.9, 1]);
    }

    // Rabo
    let matrizRabo = m4.translate(matrizBase, [-1.8, 1.5, 0]);
    matrizRabo = m4.rotateZ(matrizRabo, 0.5);
    desenharComOutline(raboPataBuffer, matrizRabo, viewProjectionMatrix, [0.3, 0.3, 0.3, 1]); // cinza escuro
}

// -- DISTRIBUIÇÃO HARMÔNICA (ESTILO SPORE)
const tamanhoLote = 20;
const colunas = 15;
const linhas = 15;
const limiteTras = 40;
const metadeX = (colunas * tamanhoLote) / 2;
const metadeZ = (linhas * tamanhoLote) / 2;

const objetosFazenda = [];

for(let l = 0; l < linhas; l++){
    for(let c = 0; c < colunas; c++){
        let obj = {coluna : c, linha : l};
        atualizarObjetoFazena(obj);
        objetosFazenda.push(obj);
    }
}

function atualizarObjetoFazena(obj){

    let desvioX = (pseudoRandom(obj.coluna, obj.linha) - 0.5) * 16;
    let desvioZ = (pseudoRandom(obj.coluna + 73, obj.linha + 42) - 0.5) * 16;
    obj.x = (obj.coluna*tamanhoLote - metadeX) + desvioX;
    obj.z = (-obj.linha*tamanhoLote) + desvioZ;

    let chance = pseudoRandom(obj.coluna+100, obj.linha+200);
    if (chance > 0.97) obj.tipo = 'silo';
    else if (chance > 0.93) obj.tipo = 'celeiro';
    else if (chance > 0.80) obj.tipo = 'vaca';
    else obj.tipo = 'arvore';
}

// --- CONFIGURAÇÃO DA NAVE ---
let navePos = [0,20,0];
let tempoAnterior = 0;
const velocidadeOvni = 20;
let inclinacaoAtualX = 0;
let inclinacaoAtualZ = 0;
let tempoAbducao = 0;

// --- CONFIGURAÇÃO DE CÂMERA ---
let cameraAtual = 2;
let cameraC = 0; // Variável para alternar entre as câmeras

// --- CONFIGURAÇÃO DE ILUMINAÇÃO ---
const luzDirecao = [-1.0, -0.8, -1.0]; 
let raioAtivo = false;
let iluminacaoAtiva = true;
let fogAtiva = true;

// Uniforms globais compartilhados por todos os draws
const globalUniforms = {
    u_lightDirection: luzDirecao,
    u_ovniPos: navePos,
    u_raioIntensidade: 0.0,
    u_iluminacaoAtiva : 1.0,
    u_fogAtiva : 1.0
};

// --- LEITURA DE TECLAS ---
const teclasPressionadas = {};
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) > -1) {
        e.preventDefault();
    }
    teclasPressionadas[key] = true;
});
window.addEventListener('keyup', (e) => {
    teclasPressionadas[e.key.toLowerCase()] = false;
});

// --- GAME LOOP ---
function render(time) {
    time *= 0.001; // Converte o tempo para segundos
    const deltaTime = time - tempoAnterior;
    tempoAnterior = time;

    
    // Ajusta o tamanho do canvas para não ficar borrado
    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);
    setUniforms(programInfo, globalUniforms);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // --- Controles de voo ---
    let inclinacaoAlvoX = 0;
    let inclinacaoAlvoZ = 0;

    if(teclasPressionadas['w'] == true || teclasPressionadas['arrowup']){
        navePos[2] -= velocidadeOvni * deltaTime;
        inclinacaoAlvoX = -0.3; // Inclina para frente
    }
    if(teclasPressionadas['s'] == true || teclasPressionadas['arrowdown']){
        navePos[2] += velocidadeOvni * deltaTime;
        inclinacaoAlvoX = 0.3; // Inclina para trás
    }
    if(teclasPressionadas['a'] == true || teclasPressionadas['arrowleft']){
        navePos[0] -= velocidadeOvni * deltaTime;
        inclinacaoAlvoZ = 0.3; // Inclina para a esquerda
    }
    if(teclasPressionadas['d'] == true || teclasPressionadas['arrowright']){
        navePos[0] += velocidadeOvni * deltaTime;
        inclinacaoAlvoZ = -0.3; // Inclina para a direita
    }

    globalUniforms.u_ovniPos = navePos;
    //Suavização das inclinações
    inclinacaoAtualX += (inclinacaoAlvoX - inclinacaoAtualX) * deltaTime * 5;
    inclinacaoAtualZ += (inclinacaoAlvoZ - inclinacaoAtualZ) * deltaTime * 5;
    
    // --- CÂMERA E PROJEÇÃO ---
    const fov = 60 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fov, aspect, 0.1, 200);
    
    // --- Controle de Câmera ---
    let offset, up;

    if (teclasPressionadas['1'] == true){
        cameraAtual = 1;
    }
    if (teclasPressionadas['2'] == true){
        cameraAtual = 2;
    }
    if (teclasPressionadas['c'] == true){
        if(cameraAtual == 2){
            cameraC = (cameraC + 1) % 4; // Alterna entre as 4 posições da câmera
        }
        teclasPressionadas['c'] = false; // Evita múltiplos incrementos por frame
    }
    if (teclasPressionadas[' '] == true){
        tempoAbducao = 1;
        globalUniforms.u_raioIntensidade = 1; 
    }
    if (teclasPressionadas['l'] == true){
        iluminacaoAtiva = !iluminacaoAtiva;
        globalUniforms.u_iluminacaoAtiva = iluminacaoAtiva ? 1.0 : 0.0;
        teclasPressionadas['l'] = false;
    }
    if (teclasPressionadas['n'] == true){
        fogAtiva = !fogAtiva;
        globalUniforms.u_fogAtiva = fogAtiva ? 1.0 : 0.0;
        teclasPressionadas['n'] = false;
    }
    tempoAbducao += (-tempoAbducao) * deltaTime * 3;
    //Controlar luz que o OVNI faz
    globalUniforms.u_raioIntensidade += (tempoAbducao - globalUniforms.u_raioIntensidade) * deltaTime * 5;
    switch(cameraAtual){
        case 1: 
            offset = [0, 40, 0];
            up = [0, 0, -1];
            break;
        case 2:
            switch(cameraC){
                case 0:
                    offset = [0, 15, 30];
                    up = [0, 1, 0];
                    break;
                case 1:
                    offset = [0, 15, -30];
                    up = [0, 1, 0];
                    break;
                case 2:
                    offset = [30, 15, 0];
                    up = [0, 1, 0];
                    break;
                case 3:
                    offset = [-30, 15, 0];
                    up = [0, 1, 0];
                    break;
            }
            break;
    }

    const cameraPosition = [
        navePos[0] + offset[0],
        navePos[1] + offset[1],
        navePos[2] + offset[2]
    ]
    const target = navePos;

    const camera = m4.lookAt(cameraPosition, target, up);
    const view = m4.inverse(camera);
    const viewProjection = m4.multiply(projection, view);

    // --- DESENHAR O CHÃO ---
    const tamanhoPoligono = 10;
    const chaoZ = Math.round(navePos[2]/tamanhoPoligono) * tamanhoPoligono;
    const chaoX = Math.round(navePos[0]/tamanhoPoligono) * tamanhoPoligono;
    let matrixChao = m4.translation([chaoX, 0, chaoZ]);
    let finalMatrixChao = m4.multiply(viewProjection, matrixChao);
    
    setBuffersAndAttributes(gl, programInfo, chaoBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: finalMatrixChao,
        u_world: matrixChao,
        u_color: [0.3, 0.8, 0.4, 1], // Verde grama
    });
    drawBufferInfo(gl, chaoBuffer);
    
    // --- SOMBRA DO OVNI ---
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(programInfo.program);
    let matrizSombra = m4.translation([navePos[0], 0.05, navePos[2]]); // 0.01 pra não z-fight com o chão
    setBuffersAndAttributes(gl, programInfo, sombraBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: m4.multiply(viewProjection, matrizSombra),
        u_world: m4.identity(),
        u_color: [0, 0, 0, 0.4], // preto semitransparente
    });
    drawBufferInfo(gl, sombraBuffer);
    gl.disable(gl.BLEND);


    // --- DESENHAR OBJETOS ---
    const posNaveZ = navePos[2];
    const posNaveX = navePos[0];

    for (let i = 0; i < objetosFazenda.length; i++){
        let obj = objetosFazenda[i];
        if (obj.z > posNaveZ + metadeZ){
            obj.linha += linhas;
            atualizarObjetoFazena(obj);
        }
        else if (obj.z < posNaveZ - metadeZ){
            obj.linha -= linhas;
            atualizarObjetoFazena(obj);
        }
        if(obj.x < posNaveX - metadeX){
            obj.coluna += colunas;
            atualizarObjetoFazena(obj);
        }
        else if (obj.x > posNaveX + metadeX){
            obj.coluna -= colunas;
            atualizarObjetoFazena(obj);
        }
        if (obj.tipo == 'arvore'){
            desenharArvore(viewProjection, obj.x, obj.z);
        }
        else if (obj.tipo == 'silo'){
            desenharSilo(viewProjection, obj.x, obj.z);
        }
        else if (obj.tipo == 'celeiro'){
            desenharCeleiro(viewProjection, obj.x, obj.z);
        }
        else if (obj.tipo == 'vaca'){
            desenharVaca(viewProjection, obj.x, obj.z);
        }
    }

    // --- DESENHAR O OVNI ---
    let matrizBaseOvni = m4.translation(navePos);
    matrizBaseOvni = m4.rotateX(matrizBaseOvni, inclinacaoAtualX);  
    matrizBaseOvni = m4.rotateZ(matrizBaseOvni, inclinacaoAtualZ); 
    matrizBaseOvni = m4.rotateY(matrizBaseOvni, time * 2);
    matrizBaseOvni = m4.scale(matrizBaseOvni, [1.5, 1.5, 1.5]);
    desenharComOutline(corpoOvniBuffer,matrizBaseOvni, viewProjection, [0.6, 0.6, 0.6, 1.0]);
    desenharComOutline(anelOvniBuffer, m4.rotateZ(m4.rotateY(matrizBaseOvni, time * 4), 0.05), viewProjection, [0.1, 0.9, 0.2, 1.0]);
    // Cabine: transparente, sem outline (outline em objeto transparente fica estranho)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const wvpCabine = m4.multiply(viewProjection, m4.translate(matrizBaseOvni, [0, 0.8, 0]));
    gl.useProgram(programInfo.program);
    setBuffersAndAttributes(gl, programInfo, cabineOvniBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: wvpCabine,
        u_world: m4.translate(matrizBaseOvni, [0, 0.8, 0]),
        u_color: [0.2, 0.8, 0.8, 0.4],
    });
    drawBufferInfo(gl, cabineOvniBuffer);

    // --- DESENHAR RAIO DE ABDUÇÃO ---
    const alturaRaio = navePos[1];
    const worldAbducao = m4.translation([navePos[0], navePos[1] - alturaRaio/2, navePos[2]]);
    const worldAbducaoEscalado = m4.scale(worldAbducao, [1, alturaRaio/8, 1]); 
    gl.depthMask(false);
    gl.useProgram(programInfo.program);
    setBuffersAndAttributes(gl, programInfo, raioAbducaoBuffer);
    setUniforms(programInfo, {
        u_worldViewProjection: m4.multiply(viewProjection, worldAbducaoEscalado),
        u_world: worldAbducaoEscalado,
        u_color: [0.8, 0.8, 0.1, 0.5 * tempoAbducao],
    });
    drawBufferInfo(gl, raioAbducaoBuffer);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);