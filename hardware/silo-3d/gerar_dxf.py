"""Gera as vistas 2D (DXF) das duas tampas do silo: tampa da base e tampa do silo.

Usa os mesmos parâmetros de gerar_stl.py, então as medidas batem com os STLs. Unidade: mm.
Vista de cima, com a peça na posição de uso (frente = -Y, conduíte = +Y), centralizada na origem.
Uso:  pip install -r requirements.txt  &&  python gerar_dxf.py
Os arquivos saem em dxf/.

Camadas:
  CORTE       (vermelho) contorno externo e furos passantes: é o que a laser corta
  REBAIXO     (azul)     rebaixo raso na face de cima (dá para gravar na laser)
  REFERENCIA  (verde)    partes que saem da chapa (abas, encaixe, bolso do DHT11):
                         só para conferência, não dá para fazer na laser
"""

import math
import os

import gerar_stl as g

CORES = {"CORTE": 1, "REBAIXO": 5, "REFERENCIA": 3}


class Dxf:
    """Escritor mínimo de DXF R12 (AC1009): abre no LaserCAD/RDWorks, LightBurn, Inkscape e CADs."""

    def __init__(self):
        self.ent = []

    def _add(self, tipo, camada, *pares):
        self.ent += ["0", tipo, "8", camada]
        for cod, val in pares:
            self.ent += [str(cod), f"{val:.4f}" if isinstance(val, float) else str(val)]

    def circulo(self, x, y, r, camada="CORTE"):
        self._add("CIRCLE", camada, (10, float(x)), (20, float(y)), (30, 0.0), (40, float(r)))

    def arco(self, x, y, r, a0, a1, camada):
        self._add("ARC", camada, (10, float(x)), (20, float(y)), (30, 0.0), (40, float(r)),
                  (50, float(a0 % 360)), (51, float(a1 % 360)))

    def linha(self, p0, p1, camada):
        self._add("LINE", camada, (10, float(p0[0])), (20, float(p0[1])), (30, 0.0),
                  (11, float(p1[0])), (21, float(p1[1])), (31, 0.0))

    def poligono(self, pts, camada="CORTE"):
        """Polilinha fechada (um caminho contínuo para a laser)."""
        self._add("POLYLINE", camada, (66, 1), (10, 0.0), (20, 0.0), (30, 0.0), (70, 1))
        for x, y in pts:
            self._add("VERTEX", camada, (10, float(x)), (20, float(y)), (30, 0.0))
        self.ent += ["0", "SEQEND", "8", camada]

    def retangulo(self, x0, x1, y0, y1, camada="CORTE"):
        self.poligono([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], camada)

    def setor(self, r_int, r_ext, a0, a1, camada):
        """Contorno de um setor de anel (abas, encaixe parcial)."""
        self.arco(0, 0, r_ext, a0, a1, camada)
        self.arco(0, 0, r_int, a0, a1, camada)
        for a in (a0, a1):
            self.linha(g.polar(r_int, a), g.polar(r_ext, a), camada)

    def salvar(self, caminho):
        cab = ["0", "SECTION", "2", "HEADER",
               "9", "$ACADVER", "1", "AC1009",
               "9", "$INSUNITS", "70", "4",        # milímetros
               "9", "$MEASUREMENT", "70", "1",     # métrico
               "0", "ENDSEC",
               "0", "SECTION", "2", "TABLES",
               "0", "TABLE", "2", "LAYER", "70", str(len(CORES))]
        for nome, cor in CORES.items():
            cab += ["0", "LAYER", "2", nome, "70", "0", "62", str(cor), "6", "CONTINUOUS"]
        cab += ["0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"]
        linhas = cab + self.ent + ["0", "ENDSEC", "0", "EOF"]
        with open(caminho, "w", encoding="ascii", newline="\r\n") as f:
            f.write("\n".join(linhas) + "\n")


# ------------------------------------------------------------------ peças
def tampa_base():
    """Igual a gerar_stl.tampa_base(), vista de cima (abas para cima)."""
    d = Dxf()
    h = g.BASE_LADO / 2
    d.retangulo(-h, h, -h, h)
    c = g.FAN_FURO_C
    for sx in (-1, 1):
        for sy in (-1, 1):
            d.circulo(sx * c, sy * c, g.PARAF_FOLGA_D / 2)
    for x, y in g.grade_hex(g.TB_FURO_PASSO, g.TB_REBAIXO_R - g.TB_FURO_D / 2 - 2):
        d.circulo(x, y, g.TB_FURO_D / 2)
    d.circulo(0, 0, g.TB_REBAIXO_R, "REBAIXO")
    r0 = g.R_SILO + 0.4
    for a in (0.0, 135.0, -135.0):
        d.setor(r0, r0 + g.ABA_ESP, a - g.ABA_ANG / 2, a + g.ABA_ANG / 2, "REFERENCIA")
    return d


def tampa_silo():
    """Igual a gerar_stl.tampa_silo(), vista de cima na posição de uso (o STL sai virado)."""
    d = Dxf()
    d.circulo(0, 0, g.R_SILO)
    fx, fy, fd = g.DHT_FURO
    d.circulo(fx, fy, fd / 2)
    for s in (-1, 1):
        d.circulo(s * g.HC_CENTROS / 2, 0, g.HC_FURO_D / 2)
    for x, y in g.CAPA_PINOS:
        d.circulo(x, y, g.CAPA_FURO_PINO_D / 2)

    def fora_da_capa(x, y):
        return not (g.CAPA_X[0] - 3 < x < g.CAPA_X[1] + 3 and g.CAPA_Y[0] - 3 < y < g.CAPA_Y[1] + 3)
    for r, n in zip(g.RESPIRO_R, (24, 28)):
        for x, y in (g.polar(r, i * 360 / n) for i in range(n)):
            if fora_da_capa(x, y):
                d.circulo(x, y, g.RESPIRO_D / 2)

    # embaixo da chapa: anel de encaixe na boca do silo e bolso do DHT11 (com o rasgo do cabo)
    r_ext = g.R_SILO - g.PAREDE - g.ENCAIXE_FOLGA
    d.circulo(0, 0, r_ext, "REFERENCIA")
    d.circulo(0, 0, r_ext - g.ENCAIXE_ESP, "REFERENCIA")
    dx, dy = g.DHT_CENTRO
    bx, by, e = g.DHT_BOLSO[0] / 2, g.DHT_BOLSO[1] / 2, 1.6
    d.retangulo(dx - bx - e, dx + bx + e, dy - by - e, dy + by + e, "REFERENCIA")
    d.retangulo(dx - bx, dx + bx, dy - by, dy + by, "REFERENCIA")
    d.retangulo(dx + bx - 0.5, dx + bx + e, dy - 4, dy + 4, "REFERENCIA")
    return d


def main():
    pasta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dxf")
    os.makedirs(pasta, exist_ok=True)
    for nome, fn in (("2_tampa_base", tampa_base), ("4_tampa_silo", tampa_silo)):
        d = fn()
        d.salvar(os.path.join(pasta, nome + ".dxf"))
        furos = sum(1 for i in range(0, len(d.ent), 2)
                    if d.ent[i] == "0" and d.ent[i + 1] == "CIRCLE" and d.ent[i + 3] == "CORTE")
        print(f"{nome:15s} {furos} círculos na camada CORTE")


if __name__ == "__main__":
    main()
