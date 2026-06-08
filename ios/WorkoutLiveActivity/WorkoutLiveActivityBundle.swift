//
//  WorkoutLiveActivityBundle.swift
//  WorkoutLiveActivity
//
//  Created by Michael Olubode on 5/30/26.
//
import SwiftUI
 import WidgetKit

 @main
 struct WorkoutLiveActivityBundle: WidgetBundle {
     var body: some Widget {
         WorkoutLiveActivityWidget()
         WorkoutSessionLiveActivityWidget()
     }
 }
