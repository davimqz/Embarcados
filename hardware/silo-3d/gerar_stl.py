"""Gera os STLs do silo de grãos (T0.7).

Medidas de origem em docs/arquitetura.md §3. Todas as medidas em mm.
Uso:  pip install -r requirements.txt  &&  python gerar_stl.py
Os arquivos saem em stl/, já na orientação de impressão.
"""

import math
import os

import numpy as np
from manifold3d import CrossSection, Manifold

SEG = 160  # segmentos dos círculos grandes
SEG_P = 48  # segmentos dos furos pequenos

# ---------------------------------------------------------------- parâmetros
MESA = 120.0           # volume da impressora: 120 x 120 x 120

# base (caixa da eletrônica)
BASE_LADO = 112.0
BASE_ALT = 42.0
BASE_PAREDE = 2.4
BASE_PISO = 2.0
PINO_CANTO_D = 3.0     # pinos nos cantos que encaixam na tampa da base
PINO_CANTO_H = 3.0
COLUNA = 6.0           # colunas de reforço nos cantos, onde ficam os pinos
PINO_CANTO_C = BASE_LADO / 2 - 3.0   # centro dos pinos, em X e Y

# protoboard 400 pontos e ESP32 (arquitetura.md §3)
PROTO_X, PROTO_Y = 83.0, 56.0   # bolso já com folga
GUIA_ALT, GUIA_ESP = 3.0, 1.6
USB_LARG, USB_ALT, USB_Z = 14.0, 11.0, 16.0   # abertura do micro-USB (centro em Z)

# painel frontal: botões 12x12 e LEDs 5 mm
BOTAO_FURO_D = 12.5
BOTAO_BOLSO = 12.6
BOTAO_BOLSO_PROF = 3.5
LED_FURO_D = 5.2       # justo, para a aba de Ø5,8 segurar o LED
PAINEL_Z = 24.0

# tampa da base
TB_ESP = 3.0
TB_FURO_PINO_D = 3.6
ABA_ALT, ABA_ESP, ABA_ANG = 4.0, 2.0, 20.0   # abas que centralizam o silo

# corpo do silo
R_SILO = 52.0          # raio externo
PAREDE = 2.0
PISO = 2.0
ALT_SILO = 112.0

# conduíte externo para os fios dos sensores (7 fios)
COND_ANG = 45.0
COND_R_CENTRO = 56.2
COND_R_EXT, COND_R_INT = 5.5, 4.0

# escotilhas (entrada em cima, saída embaixo), ambas na frente (-Y)
FRENTE = -90.0
ABERT_LARG = 36.0      # corda da abertura
PORTA_ALT = 24.0
PORTA_ANG = 25.5       # meia abertura angular da porta
PORTA_R_INT = R_SILO + 0.3
PORTA_R_EXT = R_SILO + 2.0
TRILHO_R_EXT = PORTA_R_EXT + 0.4
LABIO_R_EXT = TRILHO_R_EXT + 1.4
TRILHO_ANG = (26.0, 32.0)      # espaçador do trilho
LABIO_ANG = (22.0, 32.0)       # lábio que segura a borda da porta
ENT_ABERT_Z = (84.0, 102.0)    # abertura de entrada
ENT_TRILHO_Z = (77.0, ALT_SILO)
ENT_APOIO_Z = (77.0, 80.0)     # degrau onde a porta de entrada descansa
SAI_ABERT_Z = (PISO, 20.0)     # abertura de saída
SAI_TRILHO_Z = (0.0, 50.0)     # a porta de saída sobe até 22 mm para abrir

# tampa do silo
TAMPA_ESP = 2.4
ENCAIXE_ALT, ENCAIXE_ESP, ENCAIXE_FOLGA = 5.0, 1.6, 0.3
HC_FURO_D = 16.5
HC_CENTROS = 26.0
DHT_BOLSO = (24.0, 13.0)       # DHT11 com terminais: 23 x 12 x 5
DHT_PROF = 6.0
DHT_CENTRO = (0.0, 22.0)
DHT_FURO = (17.0, 22.0, 6.0)   # x, y, diâmetro do furo dos fios do DHT11

# capa do HC-SR04 (os pinos saem para +Y)
CAPA_X = (-28.0, 28.0)
CAPA_Y = (-15.0, 36.0)
CAPA_PAREDE = 2.0
CAPA_ALT_INT = 12.0
CAPA_TOPO = 1.6
CAPA_PINO_D, CAPA_PINO_H = 2.6, 3.0
CAPA_FURO_PINO_D = 3.3
CAPA_PINOS = [(-27.0, -14.0), (27.0, -14.0), (-27.0, 35.0), (27.0, 35.0)]


# ------------------------------------------------------------ primitivas
def caixa(x0, x1, y0, y1, z0, z1):
    return Manifold.cube((x1 - x0, y1 - y0, z1 - z0)).translate((x0, y0, z0))


def cilindro(r, z0, z1, x=0.0, y=0.0, seg=SEG):
    return Manifold.cylinder(z1 - z0, r, r, seg).translate((x, y, z0))


def tubo(r_ext, r_int, z0, z1, x=0.0, y=0.0, seg=SEG):
    return cilindro(r_ext, z0, z1, x, y, seg) - cilindro(r_int, z0 - 1, z1 + 1, x, y, seg)


def arco(r_int, r_ext, a0, a1, z0, z1, passos=64):
    """Setor de anel entre os ângulos a0 e a1 (graus)."""
    angs = np.linspace(math.radians(a0), math.radians(a1), passos)
    ext = [(r_ext * math.cos(a), r_ext * math.sin(a)) for a in angs]
    inn = [(r_int * math.cos(a), r_int * math.sin(a)) for a in angs[::-1]]
    return Manifold.extrude(CrossSection([ext + inn]), z1 - z0).translate((0, 0, z0))


def polar(r, ang):
    return r * math.cos(math.radians(ang)), r * math.sin(math.radians(ang))


def uniao(pecas):
    return Manifold.batch_boolean(pecas, 0) if len(pecas) > 1 else pecas[0]


def no_chao(m):
    """Desloca a peça para apoiar em Z = 0."""
    return m.translate((0, 0, -m.bounding_box()[2]))


def virar(m):
    """Vira de cabeça para baixo (para imprimir com o topo na mesa)."""
    return no_chao(m.rotate((180, 0, 0)))


# -------------------------------------------------------------- peças
def base():
    m = caixa(-BASE_LADO / 2, BASE_LADO / 2, -BASE_LADO / 2, BASE_LADO / 2, 0, BASE_ALT)
    di = BASE_LADO / 2 - BASE_PAREDE
    m -= caixa(-di, di, -di, di, BASE_PISO, BASE_ALT + 1)

    # colunas nos cantos, com os pinos que encaixam na tampa da base
    h, c = BASE_LADO / 2, PINO_CANTO_C
    for sx in (-1, 1):
        for sy in (-1, 1):
            xs = sorted((sx * h, sx * (h - COLUNA)))
            ys = sorted((sy * h, sy * (h - COLUNA)))
            m += caixa(xs[0], xs[1], ys[0], ys[1], 0, BASE_ALT)
            m += cilindro(PINO_CANTO_D / 2, BASE_ALT - 0.01, BASE_ALT + PINO_CANTO_H, sx * c, sy * c, SEG_P)

    # guias da protoboard: encostada na parede -X, onde fica o USB do ESP32
    x0 = -di + 0.5
    x1, y0, y1 = x0 + PROTO_X, -PROTO_Y / 2, PROTO_Y / 2
    z0, z1 = BASE_PISO, BASE_PISO + GUIA_ALT
    m += caixa(x1, x1 + GUIA_ESP, y0 - GUIA_ESP, y1 + GUIA_ESP, z0, z1)
    m += caixa(x0, x1, y0 - GUIA_ESP, y0, z0, z1)
    m += caixa(x0, x1, y1, y1 + GUIA_ESP, z0, z1)

    # abertura do micro-USB na parede -X
    m -= caixa(-BASE_LADO / 2 - 1, -di + 1, -USB_LARG / 2, USB_LARG / 2,
               USB_Z - USB_ALT / 2, USB_Z + USB_ALT / 2)

    # painel frontal (-Y): botão amarelo, botão vermelho, LED alerta, LED ventilação
    yf = -BASE_LADO / 2
    for x in (-30.0, -12.0):
        b = BOTAO_BOLSO / 2
        ressalto = caixa(x - 9, x + 9, -di, -di + BOTAO_BOLSO_PROF, PAINEL_Z - 9, PAINEL_Z + 9)
        m += ressalto
        m -= caixa(x - b, x + b, -di - 0.01, -di + BOTAO_BOLSO_PROF + 1, PAINEL_Z - b, PAINEL_Z + b)
        m -= cilindro(BOTAO_FURO_D / 2, -1, BASE_PAREDE + 2, seg=SEG_P).rotate((-90, 0, 0)) \
            .translate((x, yf - 1, PAINEL_Z))
    for x in (12.0, 30.0):
        m -= cilindro(LED_FURO_D / 2, -1, BASE_PAREDE + 2, seg=SEG_P).rotate((-90, 0, 0)) \
            .translate((x, yf - 1, PAINEL_Z))
    return m


def tampa_base():
    m = caixa(-BASE_LADO / 2, BASE_LADO / 2, -BASE_LADO / 2, BASE_LADO / 2, 0, TB_ESP)
    c = PINO_CANTO_C
    for sx in (-1, 1):
        for sy in (-1, 1):
            m -= cilindro(TB_FURO_PINO_D / 2, -1, TB_ESP + 1, sx * c, sy * c, SEG_P)
    # passagem dos fios do conduíte
    cx, cy = polar(COND_R_CENTRO, COND_ANG)
    m -= cilindro(COND_R_INT + 0.5, -1, TB_ESP + 1, cx, cy, SEG_P)
    # abas que centralizam o silo, longe do conduíte (45°) e da escotilha (-90°)
    r0 = R_SILO + 0.4
    for a in (0.0, 135.0, -135.0):
        m += arco(r0, r0 + ABA_ESP, a - ABA_ANG / 2, a + ABA_ANG / 2, TB_ESP, TB_ESP + ABA_ALT)
    return m


def trilhos(z0, z1):
    pecas = []
    for s in (-1, 1):
        a = (FRENTE + s * TRILHO_ANG[0], FRENTE + s * TRILHO_ANG[1])
        pecas.append(arco(R_SILO - 0.5, TRILHO_R_EXT, min(a), max(a), z0, z1))
        a = (FRENTE + s * LABIO_ANG[0], FRENTE + s * LABIO_ANG[1])
        pecas.append(arco(TRILHO_R_EXT - 0.01, LABIO_R_EXT, min(a), max(a), z0, z1))
    return pecas


def abertura(z0, z1):
    meia = math.degrees(math.asin(ABERT_LARG / 2 / R_SILO))
    return arco(R_SILO - PAREDE - 1, R_SILO + 1, FRENTE - meia, FRENTE + meia, z0, z1)


def corpo():
    pecas = [tubo(R_SILO, R_SILO - PAREDE, 0, ALT_SILO), cilindro(R_SILO - PAREDE + 0.01, 0, PISO)]
    cx, cy = polar(COND_R_CENTRO, COND_ANG)
    pecas.append(cilindro(COND_R_EXT, 0, ALT_SILO, cx, cy, SEG_P))
    pecas += trilhos(*ENT_TRILHO_Z) + trilhos(*SAI_TRILHO_Z)
    pecas.append(arco(R_SILO - 0.5, TRILHO_R_EXT, FRENTE - PORTA_ANG - 0.6, FRENTE + PORTA_ANG + 0.6,
                      *ENT_APOIO_Z))
    m = uniao(pecas)
    m -= cilindro(COND_R_INT, -1, ALT_SILO + 1, cx, cy, SEG_P)
    m -= abertura(*ENT_ABERT_Z)
    m -= abertura(*SAI_ABERT_Z)
    return m


def escotilha():
    m = arco(PORTA_R_INT, PORTA_R_EXT, FRENTE - PORTA_ANG, FRENTE + PORTA_ANG, 0, PORTA_ALT)
    # puxador: nervura vertical no centro, entre os lábios do trilho
    m += arco(PORTA_R_EXT - 0.01, PORTA_R_EXT + 2.5, FRENTE - 4, FRENTE + 4, 0, PORTA_ALT)
    # gira para o centro da peça ficar perto da origem
    return no_chao(m.translate((0, R_SILO, 0)))


def tampa_silo():
    """Modelada montada: Z = 0 é a face de baixo, encostada na boca do silo."""
    m = cilindro(R_SILO, 0, TAMPA_ESP)
    r_ext = R_SILO - PAREDE - ENCAIXE_FOLGA
    m += tubo(r_ext, r_ext - ENCAIXE_ESP, -ENCAIXE_ALT, 0.01)

    # bolso do DHT11 embaixo da tampa, com rasgo para o cabo do lado +X
    dx, dy = DHT_CENTRO
    bx, by = DHT_BOLSO[0] / 2, DHT_BOLSO[1] / 2
    e = 1.6
    m += caixa(dx - bx - e, dx + bx + e, dy - by - e, dy + by + e, -DHT_PROF, 0.01)
    m -= caixa(dx - bx, dx + bx, dy - by, dy + by, -DHT_PROF - 1, 0)
    m -= caixa(dx + bx - 0.5, dx + bx + e + 1, dy - 4, dy + 4, -DHT_PROF - 1, 0)
    fx, fy, fd = DHT_FURO
    m -= cilindro(fd / 2, -1, TAMPA_ESP + 1, fx, fy, SEG_P)

    # furos dos transdutores do HC-SR04 e dos pinos da capa
    for s in (-1, 1):
        m -= cilindro(HC_FURO_D / 2, -1, TAMPA_ESP + 1, s * HC_CENTROS / 2, 0, SEG_P)
    for x, y in CAPA_PINOS:
        m -= cilindro(CAPA_FURO_PINO_D / 2, -1, TAMPA_ESP + 1, x, y, SEG_P)
    return m


def capa_sensor():
    """Modelada montada: Z = 0 é a borda que encosta na tampa."""
    x0, x1 = CAPA_X
    y0, y1 = CAPA_Y
    e = CAPA_PAREDE
    alt = CAPA_ALT_INT + CAPA_TOPO
    m = caixa(x0, x1, y0, y1, 0, alt)
    m -= caixa(x0 + e, x1 - e, y0 + e, y1 - e, -1, CAPA_ALT_INT)
    # saída dos fios na parede +X, perto do conduíte
    m -= caixa(x1 - e - 1, x1 + 1, 20.0, 32.0, -1, 8.0)
    for x, y in CAPA_PINOS:
        m += cilindro(CAPA_PINO_D / 2, -CAPA_PINO_H, 0.01, x, y, SEG_P)
    return m


def peca_teste():
    """Plaquinha para conferir os encaixes antes de imprimir o silo."""
    esp = 2.4
    m = caixa(-54, 48, -16, 16, 0, esp)
    for s in (-1, 1):
        m -= cilindro(HC_FURO_D / 2, -1, esp + 1, -28 + s * HC_CENTROS / 2, 0, SEG_P)
    # botão: furo da capa + bolso do corpo, como no painel da base
    m += caixa(4, 22, -9, 9, esp - 0.01, esp + BOTAO_BOLSO_PROF)
    b = BOTAO_BOLSO / 2
    m -= caixa(13 - b, 13 + b, -b, b, esp, esp + BOTAO_BOLSO_PROF + 1)
    m -= cilindro(BOTAO_FURO_D / 2, -1, esp + 1, 13, 0, SEG_P)
    # LED: furo justo (usado no painel) e furo com folga
    m -= cilindro(LED_FURO_D / 2, -1, esp + 1, 26.5, 6, SEG_P)
    m -= cilindro(5.5 / 2, -1, esp + 1, 26.5, -6, SEG_P)
    # DHT11: bolso da tampa
    bx, by = DHT_BOLSO[0] / 2, DHT_BOLSO[1] / 2
    m += caixa(40 - by - 1.6, 40 + by + 1.6, -bx - 1.6, bx + 1.6, esp - 0.01, esp + 4)
    m -= caixa(40 - by, 40 + by, -bx, bx, esp, esp + 5)
    return m


# ------------------------------------------------------------- exportação
def salvar_stl(m, caminho):
    malha = m.to_mesh()
    v = np.asarray(malha.vert_properties)[:, :3].astype(np.float32)
    t = np.asarray(malha.tri_verts).astype(np.int64)
    a, b, c = v[t[:, 0]], v[t[:, 1]], v[t[:, 2]]
    n = np.cross(b - a, c - a)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    reg = np.zeros(len(t), dtype=[("n", "<f4", 3), ("a", "<f4", 3), ("b", "<f4", 3),
                                   ("c", "<f4", 3), ("attr", "<u2")])
    reg["n"], reg["a"], reg["b"], reg["c"] = n, a, b, c
    with open(caminho, "wb") as f:
        f.write(b"silo-grupo3".ljust(80, b" "))
        f.write(np.uint32(len(t)).tobytes())
        f.write(reg.tobytes())


def pecas_impressao():
    return {
        "1_base": base(),
        "2_tampa_base": tampa_base(),
        "3_corpo": corpo(),
        "4_tampa_silo": virar(tampa_silo()),
        "5_capa_sensor": virar(capa_sensor()),
        "6_escotilha": escotilha(),
        "0_peca_teste": peca_teste(),
    }


def montagem():
    """Peças na posição de uso, para conferência visual."""
    z_tb = BASE_ALT
    z_silo = z_tb + TB_ESP
    z_tampa = z_silo + ALT_SILO
    porta = arco(PORTA_R_INT, PORTA_R_EXT, FRENTE - PORTA_ANG, FRENTE + PORTA_ANG, 0, PORTA_ALT)
    porta += arco(PORTA_R_EXT - 0.01, PORTA_R_EXT + 2.5, FRENTE - 4, FRENTE + 4, 0, PORTA_ALT)
    return {
        "base": base(),
        "tampa_base": tampa_base().translate((0, 0, z_tb)),
        "corpo": corpo().translate((0, 0, z_silo)),
        "porta_saida": porta.translate((0, 0, z_silo)),
        "porta_entrada": porta.translate((0, 0, z_silo + ENT_APOIO_Z[1])),
        "tampa_silo": tampa_silo().translate((0, 0, z_tampa)),
        "capa_sensor": capa_sensor().translate((0, 0, z_tampa + TAMPA_ESP)),
    }


def main():
    pasta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stl")
    os.makedirs(pasta, exist_ok=True)
    for nome, m in pecas_impressao().items():
        x0, y0, z0, x1, y1, z1 = m.bounding_box()
        dims = (x1 - x0, y1 - y0, z1 - z0)
        cabe = all(d <= MESA for d in dims)
        status = m.status().name
        salvar_stl(m, os.path.join(pasta, nome + ".stl"))
        print(f"{nome:15s} {dims[0]:6.1f} x {dims[1]:6.1f} x {dims[2]:6.1f} mm  "
              f"vol {m.volume() / 1000:6.1f} cm3  genus {m.genus():3d}  {status}  "
              f"{'ok' if cabe else 'NAO CABE NA MESA'}")


if __name__ == "__main__":
    main()
