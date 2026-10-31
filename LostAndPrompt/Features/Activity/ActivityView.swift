import SwiftUI
import Charts

/// Estadísticas globales, en una sola pantalla tranquila.
struct ActivityView: View {
    @Environment(AppModel.self) private var model
    @State private var period = 30

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Actividad").font(.largeTitle.weight(.bold))
                        Text("Costo estimado según los precios públicos de cada modelo.")
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Picker("Periodo", selection: $period) {
                        Text("7 días").tag(7)
                        Text("30 días").tag(30)
                        Text("Todo").tag(365)
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    .fixedSize()
                }

                HStack(spacing: 40) {
                    summary(totalCost.usd, "Costo estimado")
                    summary(sessions.count.grouped, "Sesiones")
                    summary(sessions.map(\.userMessages).reduce(0, +).grouped, "Mensajes tuyos")
                    summary(Set(sessions.map(\.cwd)).count.grouped, "Carpetas")
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Costo por día").font(.headline)
                    Chart(dailyCost, id: \.day) { item in
                        BarMark(x: .value("Día", item.day, unit: .day), y: .value("Costo", item.cost))
                            .foregroundStyle(Color.accentColor.gradient)
                            .cornerRadius(3)
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading) { value in
                            AxisGridLine()
                            AxisValueLabel { if let v = value.as(Double.self) { Text(v.usd) } }
                        }
                    }
                    .frame(height: 180)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Carpetas con más uso").font(.headline)
                    let top = topFolders
                    let maxCost = top.first?.cost ?? 1
                    ForEach(top, id: \.path) { item in
                        HStack(spacing: 12) {
                            Label(item.path == Session.homePath ? String(localized: "Inicio") : (item.path as NSString).lastPathComponent,
                                  systemImage: item.path == Session.homePath ? "house" : "folder")
                                .frame(width: 220, alignment: .leading)
                                .lineLimit(1)
                            GeometryReader { proxy in
                                Capsule().fill(Color.accentColor.opacity(0.75))
                                    .frame(width: max(4, proxy.size.width * item.cost / maxCost))
                            }
                            .frame(height: 8)
                            Text(item.cost.usd).monospacedDigit().foregroundStyle(.secondary)
                                .frame(width: 90, alignment: .trailing)
                        }
                    }
                }
            }
            .padding(32)
            .frame(maxWidth: 900, alignment: .leading)
        }
        .navigationTitle("")
    }

    private var sessions: [Session] {
        let start = Calendar.current.date(byAdding: .day, value: -period, to: model.now)!
        return model.sessions.filter { $0.lastActivity >= start && $0.userMessages > 0 }
    }

    private var totalCost: Double { sessions.compactMap(\.costUSD).reduce(0, +) }

    private var dailyCost: [(day: Date, cost: Double)] {
        let grouped = Dictionary(grouping: sessions) { Calendar.current.startOfDay(for: $0.lastActivity) }
        return grouped.map { ($0.key, $0.value.compactMap(\.costUSD).reduce(0, +)) }.sorted { $0.day < $1.day }
    }

    private var topFolders: [(path: String, cost: Double)] {
        let grouped: [String: [Session]] = Dictionary(grouping: sessions, by: \.cwd)
        let totals: [(path: String, cost: Double)] = grouped.map { entry in
            (path: entry.key, cost: entry.value.compactMap(\.costUSD).reduce(0, +))
        }
        return Array(totals.sorted { $0.cost > $1.cost }.prefix(6))
    }

    private func summary(_ value: String, _ label: LocalizedStringKey) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title.weight(.semibold)).monospacedDigit()
            Text(label).foregroundStyle(.secondary)
        }
    }
}

#Preview {
    ActivityView().environment(MockData.model()).frame(width: 900, height: 720)
}
